from django.db import transaction
from django.utils import timezone

from . import ml_engine
from .models import EngineSettings, InterventionNote, OperationalRecord, PredictionAlert

Risk = PredictionAlert.Risk


def classify(score, cfg):
    if score < cfg.pass_threshold:
        return Risk.HIGH
    if score < cfg.moderate_threshold:
        return Risk.MODERATE
    return Risk.LOW


@transaction.atomic
def escalate(alert, user=None):
    """Add a prediction to the Senior Manager intervention queue (idempotent)."""
    if alert.escalated:
        return alert
    alert.escalated = True
    alert.escalated_at = timezone.now()
    alert.escalated_by = user
    alert.ticket_number = PredictionAlert.next_ticket_number()
    alert.status = PredictionAlert.Status.PENDING
    alert.save()
    who = user.display_name if user else "the AI early warning engine"
    InterventionNote.objects.create(
        alert=alert,
        kind=InterventionNote.Kind.SYSTEM,
        text=f"Escalated to the Senior Manager intervention queue by {who}.",
    )
    return alert


@transaction.atomic
def run_prediction(employee, task_name, completion, hours, user=None, recorded_at=None, auto_escalate=True):
    """Store an operational record, run the model, and raise an early warning if needed."""
    cfg = EngineSettings.load()
    result = ml_engine.predict(completion, hours, cfg.pass_threshold)
    when = recorded_at or timezone.now()
    record = OperationalRecord.objects.create(
        employee=employee,
        task_name=task_name,
        task_completion_rate=completion,
        working_hours_logged=hours,
        recorded_by=user,
        recorded_at=when,
    )
    alert = PredictionAlert.objects.create(
        employee=employee,
        record=record,
        predicted_score=result["score"],
        confidence=result["confidence"],
        risk_level=classify(result["score"], cfg),
        created_at=when,
    )
    if auto_escalate and alert.risk_level == Risk.HIGH:
        escalate(alert, user=None)
    return alert
