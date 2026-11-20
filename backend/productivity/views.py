import logging

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import CanInputData, CanManageInterventions, IsAdminRole

from . import ml_engine, services
from .models import Department, EngineSettings, Employee, InterventionNote, PredictionAlert
from .serializers import (
    AlertDetailSerializer,
    AlertSerializer,
    AssigneeSerializer,
    EmployeeDetailSerializer,
    EmployeeSerializer,
    EngineSettingsSerializer,
    NoteSerializer,
    PredictRequestSerializer,
    RecordSerializer,
)

logger = logging.getLogger(__name__)
Risk = PredictionAlert.Risk


class EmployeeViewSet(viewsets.ModelViewSet):
    """Workflow profiles (Operational Record Profile View, 5.1.3)."""

    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = Employee.objects.prefetch_related("predictions")
        q = self.request.query_params.get("search")
        dept = self.request.query_params.get("department")
        if q:
            qs = qs.filter(Q(full_name__icontains=q) | Q(employee_id__icontains=q))
        if dept:
            qs = qs.filter(department=dept)
        return qs

    def get_serializer_class(self):
        return EmployeeDetailSerializer if self.action == "retrieve" else EmployeeSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [CanInputData()]


class PredictView(APIView):
    """POST /api/predict/ - store operational data, run the AI forecast, raise early warnings."""

    permission_classes = [CanInputData]

    def post(self, request):
        serializer = PredictRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            employee = Employee.objects.get(employee_id=data["employee_id"])
        except Employee.DoesNotExist:
            return Response({"error": "No workflow profile with that employee ID."}, status=404)

        try:
            alert = services.run_prediction(
                employee,
                data["task_name"],
                data["task_completion_rate"],
                data["working_hours_logged"],
                user=request.user,
            )
        except Exception:  # noqa: BLE001 - mirrors the project's documented error contract
            logger.exception("ML engine error")
            return Response({"error": "Internal Prediction Processing Error"}, status=500)

        if alert.escalated:
            outcome, message = "escalated", (
                f"High risk of productivity failure predicted. Intervention Alert {alert.ticket_id} "
                "has been generated for senior managers."
            )
        elif alert.risk_level == Risk.MODERATE:
            outcome, message = "watch", "Workflow is passing but close to the threshold. Consider escalating."
        else:
            outcome, message = "stable", "Workflow is on track to meet performance targets."

        return Response(
            {
                "status": outcome,
                "predicted_score": alert.predicted_score,
                "confidence": alert.confidence,
                "message": message,
                "alert": AlertSerializer(alert).data,
                "record": RecordSerializer(alert.record).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AlertViewSet(viewsets.ReadOnlyModelViewSet):
    """Senior Manager Intervention Queue (5.1.6) and its actions."""

    def get_queryset(self):
        qs = PredictionAlert.objects.select_related("employee", "assigned_to", "record").prefetch_related(
            "notes__author"
        )
        p = self.request.query_params
        # The queue only lists escalated tickets; detail actions (e.g. escalating a moderate-risk
        # prediction) must still be able to reach non-escalated rows.
        if self.action == "list" and p.get("all") != "1":
            qs = qs.filter(escalated=True)
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("employee"):
            qs = qs.filter(employee_id=p["employee"])
        q = (p.get("search") or "").strip()
        if q:
            cond = (
                Q(employee__full_name__icontains=q)
                | Q(employee__employee_id__icontains=q)
                | Q(employee__department__icontains=q)
            )
            digits = "".join(c for c in q if c.isdigit())
            if digits:
                cond |= Q(ticket_number=int(digits))
            qs = qs.filter(cond)
        return qs.order_by("-escalated_at", "-created_at")

    def get_serializer_class(self):
        return AlertDetailSerializer if self.action == "retrieve" else AlertSerializer

    def get_permissions(self):
        if self.action in ("assign", "set_status", "notes"):
            return [CanManageInterventions()]
        return [IsAuthenticated()]

    @action(detail=False, methods=["get"])
    def assignees(self, request):
        users = User.objects.filter(is_active=True, role__in=[User.Role.SENIOR_MANAGER, User.Role.ADMIN])
        return Response(AssigneeSerializer(users, many=True).data)

    def _detail(self, alert):
        alert = PredictionAlert.objects.select_related("employee", "assigned_to", "record").get(pk=alert.pk)
        return Response(AlertDetailSerializer(alert).data)

    @action(detail=True, methods=["post"])
    def escalate(self, request, pk=None):
        alert = self.get_object()
        services.escalate(alert, user=request.user)
        return self._detail(alert)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        alert = self.get_object()
        try:
            assignee = User.objects.get(pk=request.data.get("assigned_to"), is_active=True)
        except (User.DoesNotExist, ValueError, TypeError):
            raise ValidationError({"assigned_to": "Choose a valid manager."})
        alert.assigned_to = assignee
        if alert.status == PredictionAlert.Status.PENDING:
            alert.status = PredictionAlert.Status.IN_PROGRESS
        alert.save()
        InterventionNote.objects.create(
            alert=alert,
            author=request.user,
            kind=InterventionNote.Kind.SYSTEM,
            text=f"Assigned to {assignee.display_name}.",
        )
        return self._detail(alert)

    @action(detail=True, methods=["post"], url_path="status")
    def set_status(self, request, pk=None):
        alert = self.get_object()
        new = request.data.get("status")
        if new not in PredictionAlert.Status.values:
            raise ValidationError({"status": "Unknown status."})
        if new != alert.status:
            alert.status = new
            alert.save(update_fields=["status"])
            InterventionNote.objects.create(
                alert=alert,
                author=request.user,
                kind=InterventionNote.Kind.SYSTEM,
                text=f"Status changed to {alert.get_status_display()}.",
            )
        return self._detail(alert)

    @action(detail=True, methods=["post"])
    def notes(self, request, pk=None):
        alert = self.get_object()
        text = (request.data.get("text") or "").strip()
        kind = request.data.get("kind", InterventionNote.Kind.INTERVENTION)
        if not text:
            raise ValidationError({"text": "Write the note before saving."})
        if kind not in InterventionNote.Kind.values or kind == InterventionNote.Kind.SYSTEM:
            raise ValidationError({"kind": "Unknown note type."})
        note = InterventionNote.objects.create(alert=alert, author=request.user, kind=kind, text=text)
        return Response(NoteSerializer(note).data, status=status.HTTP_201_CREATED)


class DashboardView(APIView):
    """GET /api/dashboard/ - KPIs and department forecast for the Main Analytics Dashboard (5.1.2)."""

    def get(self, request):
        cfg = EngineSettings.load()
        meta = ml_engine.model_meta()

        dept_scores = {d: [] for d in Department.values}
        dept_risk = {d: 0 for d in Department.values}
        total = at_risk = 0
        breakdown = {"LOW": 0, "MODERATE": 0, "HIGH": 0}

        for emp in Employee.objects.prefetch_related("predictions"):
            total += 1
            preds = list(emp.predictions.all())
            if not preds:
                continue
            latest = max(preds, key=lambda p: (p.created_at, p.id))
            dept_scores.setdefault(emp.department, []).append(latest.predicted_score)
            breakdown[latest.risk_level] += 1
            if latest.risk_level == Risk.HIGH:
                at_risk += 1
                dept_risk[emp.department] = dept_risk.get(emp.department, 0) + 1

        departments = [
            {
                "department": name,
                "average_score": round(sum(s) / len(s), 1) if s else None,
                "workflows": len(s),
                "at_risk": dept_risk.get(name, 0),
            }
            for name, s in dept_scores.items()
        ]

        pending = PredictionAlert.objects.filter(escalated=True, status=PredictionAlert.Status.PENDING)
        latest = pending.select_related("employee").order_by("-escalated_at").first()
        accuracy = meta.get("accuracy")

        return Response(
            {
                "total_workflows": total,
                "at_risk_workflows": at_risk,
                "model_accuracy": round(accuracy * 100, 1) if accuracy is not None else None,
                "pass_threshold": cfg.pass_threshold,
                "risk_breakdown": breakdown,
                "departments": departments,
                "pending_alerts": pending.count(),
                "latest_alert": {
                    "id": latest.id,
                    "ticket_id": latest.ticket_id,
                    "employee_name": latest.employee.full_name,
                }
                if latest
                else None,
            }
        )


def _engine_payload():
    return {**EngineSettingsSerializer(EngineSettings.load()).data, "model": ml_engine.model_meta()}


class EngineSettingsView(APIView):
    """Administrator use case: configure ML engine parameters."""

    def get_permissions(self):
        return [IsAuthenticated()] if self.request.method == "GET" else [IsAdminRole()]

    def get(self, request):
        return Response(_engine_payload())

    def put(self, request):
        serializer = EngineSettingsSerializer(EngineSettings.load(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(_engine_payload())


class RetrainView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        cfg = EngineSettings.load()
        ml_engine.train_and_save(cfg.pass_threshold, cfg.n_estimators, cfg.max_depth)
        return Response(_engine_payload())
