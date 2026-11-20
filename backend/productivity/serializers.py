from rest_framework import serializers

from accounts.models import User

from .models import EngineSettings, Employee, InterventionNote, OperationalRecord, PredictionAlert


class RecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = OperationalRecord
        fields = ["id", "task_name", "task_completion_rate", "working_hours_logged", "recorded_at"]


class LatestPredictionMixin:
    def _latest(self, obj):
        preds = list(obj.predictions.all())
        return max(preds, key=lambda p: (p.created_at, p.id)) if preds else None


class EmployeeSerializer(LatestPredictionMixin, serializers.ModelSerializer):
    latest_score = serializers.SerializerMethodField()
    latest_risk = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id", "employee_id", "full_name", "department", "attendance_rate",
            "enrollment_date", "latest_score", "latest_risk",
        ]
        read_only_fields = ["enrollment_date"]

    def validate_attendance_rate(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("Attendance must be between 0 and 100.")
        return value

    def get_latest_score(self, obj):
        p = self._latest(obj)
        return p.predicted_score if p else None

    def get_latest_risk(self, obj):
        p = self._latest(obj)
        return p.risk_level if p else None


class EmployeeDetailSerializer(EmployeeSerializer):
    records = serializers.SerializerMethodField()
    last_sprint_average = serializers.SerializerMethodField()

    class Meta(EmployeeSerializer.Meta):
        fields = EmployeeSerializer.Meta.fields + ["records", "last_sprint_average"]

    def get_records(self, obj):
        return RecordSerializer(obj.records.all()[:10], many=True).data

    def get_last_sprint_average(self, obj):
        recent = [r.task_completion_rate for r in obj.records.all()[:3]]
        return round(sum(recent) / len(recent), 1) if recent else None


class PredictRequestSerializer(serializers.Serializer):
    employee_id = serializers.CharField()
    task_name = serializers.CharField(max_length=100)
    task_completion_rate = serializers.FloatField(min_value=0, max_value=100)
    working_hours_logged = serializers.FloatField(min_value=0, max_value=24)


class NoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = InterventionNote
        fields = ["id", "kind", "kind_label", "text", "author_name", "created_at"]

    def get_author_name(self, obj):
        return obj.author.display_name if obj.author else "System"


class AlertEmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = ["id", "employee_id", "full_name", "department"]


class AlertSerializer(serializers.ModelSerializer):
    ticket_id = serializers.ReadOnlyField()
    employee = AlertEmployeeSerializer(read_only=True)
    risk_label = serializers.CharField(source="get_risk_level_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    task_name = serializers.CharField(source="record.task_name", read_only=True)

    class Meta:
        model = PredictionAlert
        fields = [
            "id", "ticket_id", "employee", "task_name", "predicted_score", "confidence",
            "risk_level", "risk_label", "status", "status_label", "escalated", "escalated_at",
            "assigned_to", "assigned_to_name", "created_at",
        ]

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.display_name if obj.assigned_to else None


class AlertDetailSerializer(AlertSerializer):
    notes = NoteSerializer(many=True, read_only=True)

    class Meta(AlertSerializer.Meta):
        fields = AlertSerializer.Meta.fields + ["notes"]


class AssigneeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "display_name", "role", "job_title"]


class EngineSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = EngineSettings
        fields = ["pass_threshold", "moderate_threshold", "n_estimators", "max_depth"]

    def validate(self, attrs):
        current = self.instance
        pass_t = attrs.get("pass_threshold", current.pass_threshold if current else 50.0)
        mod_t = attrs.get("moderate_threshold", current.moderate_threshold if current else 65.0)
        if not 0 < pass_t < mod_t <= 100:
            raise serializers.ValidationError(
                "Thresholds must satisfy 0 < pass threshold < moderate threshold <= 100."
            )
        return attrs

    def validate_n_estimators(self, value):
        if not 10 <= value <= 500:
            raise serializers.ValidationError("Use between 10 and 500 trees.")
        return value

    def validate_max_depth(self, value):
        if not 2 <= value <= 30:
            raise serializers.ValidationError("Use a depth between 2 and 30.")
        return value
