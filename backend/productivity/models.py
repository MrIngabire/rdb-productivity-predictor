from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Max
from django.utils import timezone


class Department(models.TextChoices):
    BUSINESS_REGISTRATION = "Business Registration", "Business Registration"
    INVESTMENT_PROMOTION = "Investment Promotion", "Investment Promotion"
    DIGITAL_SERVICES = "Digital Services", "Digital Services"
    ENTERPRISE_DEVELOPMENT = "Enterprise Development", "Enterprise Development"


class Employee(models.Model):
    """A workflow profile (staff member) whose productivity is tracked."""

    employee_id = models.CharField(max_length=20, unique=True)
    full_name = models.CharField(max_length=150)
    department = models.CharField(max_length=50, choices=Department.choices)
    attendance_rate = models.FloatField(default=90.0)
    enrollment_date = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name


class OperationalRecord(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="records")
    task_name = models.CharField(max_length=100)
    task_completion_rate = models.FloatField()
    working_hours_logged = models.FloatField()
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    recorded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-recorded_at", "-id"]

    def __str__(self):
        return f"{self.employee.full_name}: {self.task_name} ({self.task_completion_rate}%)"


class PredictionAlert(models.Model):
    """One AI prediction per operational record. High-risk ones are escalated as tickets."""

    class Risk(models.TextChoices):
        LOW = "LOW", "Low Risk"
        MODERATE = "MODERATE", "Moderate Risk"
        HIGH = "HIGH", "High Risk - Intervention Required"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending Intervention"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        RESOLVED = "RESOLVED", "Resolved"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="predictions")
    record = models.ForeignKey(OperationalRecord, on_delete=models.CASCADE, related_name="predictions")
    predicted_score = models.FloatField()
    confidence = models.FloatField(default=0.0, help_text="Percent of forest trees agreeing with the verdict.")
    risk_level = models.CharField(max_length=20, choices=Risk.choices, default=Risk.MODERATE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    escalated = models.BooleanField(default=False)
    escalated_at = models.DateTimeField(null=True, blank=True)
    escalated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    ticket_number = models.PositiveIntegerField(null=True, blank=True, unique=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_alerts"
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]

    @property
    def ticket_id(self):
        return f"#ALT-{self.ticket_number}" if self.ticket_number else None

    @classmethod
    def next_ticket_number(cls):
        return (cls.objects.aggregate(m=Max("ticket_number"))["m"] or 800) + 1

    def __str__(self):
        return f"Alert {self.ticket_id or self.pk} - {self.employee.full_name}"


class InterventionNote(models.Model):
    """Targeted interventions, support plans and monitoring sessions logged against a ticket."""

    class Kind(models.TextChoices):
        INTERVENTION = "INTERVENTION", "Targeted intervention"
        SUPPORT_PLAN = "SUPPORT_PLAN", "Personalized support plan"
        MONITORING = "MONITORING", "Monitoring session"
        SYSTEM = "SYSTEM", "System event"

    alert = models.ForeignKey(PredictionAlert, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.INTERVENTION)
    text = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]


class EngineSettings(models.Model):
    """Singleton holding the ML engine parameters an administrator can configure."""

    pass_threshold = models.FloatField(default=50.0, help_text="Predicted scores below this are High Risk (fail).")
    moderate_threshold = models.FloatField(default=65.0, help_text="Scores below this (but passing) are Moderate Risk.")
    n_estimators = models.PositiveIntegerField(default=100)
    max_depth = models.PositiveIntegerField(default=8)

    class Meta:
        verbose_name = "ML engine settings"
        verbose_name_plural = "ML engine settings"

    def clean(self):
        if not 0 < self.pass_threshold < self.moderate_threshold <= 100:
            raise ValidationError("Thresholds must satisfy 0 < pass threshold < moderate threshold <= 100.")

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "ML engine settings"
