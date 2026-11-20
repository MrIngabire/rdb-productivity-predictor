from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import AlertViewSet, DashboardView, EmployeeViewSet, EngineSettingsView, PredictView, RetrainView

router = SimpleRouter()
router.register("employees", EmployeeViewSet, basename="employee")
router.register("alerts", AlertViewSet, basename="alert")

urlpatterns = [
    path("predict/", PredictView.as_view()),
    path("dashboard/", DashboardView.as_view()),
    path("settings/", EngineSettingsView.as_view()),
    path("settings/retrain/", RetrainView.as_view()),
] + router.urls
