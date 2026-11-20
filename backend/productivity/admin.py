from django.contrib import admin

from .models import EngineSettings, Employee, InterventionNote, OperationalRecord, PredictionAlert


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("employee_id", "full_name", "department", "attendance_rate")
    list_filter = ("department",)
    search_fields = ("employee_id", "full_name")


@admin.register(OperationalRecord)
class OperationalRecordAdmin(admin.ModelAdmin):
    list_display = ("employee", "task_name", "task_completion_rate", "working_hours_logged", "recorded_at")
    list_filter = ("task_name",)


class NoteInline(admin.TabularInline):
    model = InterventionNote
    extra = 0


@admin.register(PredictionAlert)
class PredictionAlertAdmin(admin.ModelAdmin):
    list_display = ("ticket_id", "employee", "predicted_score", "confidence", "risk_level", "status", "escalated")
    list_filter = ("risk_level", "status", "escalated")
    inlines = [NoteInline]


admin.site.register(EngineSettings)
