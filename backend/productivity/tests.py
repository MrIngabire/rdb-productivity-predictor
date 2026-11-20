from rest_framework.test import APITestCase

from accounts.models import User

from . import ml_engine
from .models import Department, EngineSettings, Employee, PredictionAlert


class ProductivityApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("admin@rdb.rw", "password123", first_name="A", last_name="Admin", role=User.Role.ADMIN)
        cls.supervisor = User.objects.create_user("sup@rdb.rw", "password123", first_name="S", last_name="Sup", role=User.Role.SUPERVISOR)
        cls.manager = User.objects.create_user("mgr@rdb.rw", "password123", first_name="M", last_name="Mgr", role=User.Role.SENIOR_MANAGER)
        cls.emp = Employee.objects.create(employee_id="RDB-T-1", full_name="Test Person", department=Department.DIGITAL_SERVICES)
        EngineSettings.load()

    def predict(self, completion, hours=8):
        return self.client.post(
            "/api/predict/",
            {"employee_id": "RDB-T-1", "task_name": "Test task", "task_completion_rate": completion, "working_hours_logged": hours},
            format="json",
        )

    def test_login_returns_token(self):
        res = self.client.post("/api/auth/login/", {"email": "ADMIN@rdb.rw", "password": "password123"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("token", res.data)

    def test_login_rejects_bad_password(self):
        res = self.client.post("/api/auth/login/", {"email": "admin@rdb.rw", "password": "nope"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_endpoints_require_authentication(self):
        self.assertEqual(self.client.get("/api/dashboard/").status_code, 401)

    def test_low_completion_is_escalated_with_ticket(self):
        self.client.force_authenticate(self.supervisor)
        res = self.predict(40)
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "escalated")
        self.assertTrue(res.data["alert"]["ticket_id"].startswith("#ALT-"))
        self.assertEqual(PredictionAlert.objects.filter(escalated=True).count(), 1)

    def test_high_completion_is_stable_and_not_escalated(self):
        self.client.force_authenticate(self.supervisor)
        res = self.predict(92)
        self.assertEqual(res.data["status"], "stable")
        self.assertFalse(res.data["alert"]["escalated"])

    def test_moderate_can_be_escalated_manually(self):
        self.client.force_authenticate(self.supervisor)
        res = self.predict(65)
        self.assertEqual(res.data["status"], "watch")
        alert_id = res.data["alert"]["id"]
        res = self.client.post(f"/api/alerts/{alert_id}/escalate/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["escalated"])

    def test_validation_rejects_out_of_range_values(self):
        self.client.force_authenticate(self.supervisor)
        self.assertEqual(self.predict(140).status_code, 400)

    def test_senior_manager_can_assign_and_log_notes_but_cannot_input_data(self):
        self.client.force_authenticate(self.supervisor)
        alert_id = self.predict(30).data["alert"]["id"]
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.predict(50).status_code, 403)
        res = self.client.post(f"/api/alerts/{alert_id}/assign/", {"assigned_to": self.manager.id}, format="json")
        self.assertEqual(res.data["status"], "IN_PROGRESS")
        res = self.client.post(f"/api/alerts/{alert_id}/notes/", {"kind": "SUPPORT_PLAN", "text": "Weekly coaching"}, format="json")
        self.assertEqual(res.status_code, 201)
        res = self.client.post(f"/api/alerts/{alert_id}/status/", {"status": "RESOLVED"}, format="json")
        self.assertEqual(res.data["status"], "RESOLVED")

    def test_supervisor_cannot_manage_interventions_or_settings(self):
        self.client.force_authenticate(self.supervisor)
        alert_id = self.predict(30).data["alert"]["id"]
        self.assertEqual(self.client.post(f"/api/alerts/{alert_id}/notes/", {"text": "x"}, format="json").status_code, 403)
        self.assertEqual(self.client.put("/api/settings/", {"pass_threshold": 40}, format="json").status_code, 403)
        self.assertEqual(self.client.get("/api/users/").status_code, 403)

    def test_admin_can_configure_engine_and_provision_users(self):
        self.client.force_authenticate(self.admin)
        res = self.client.put("/api/settings/", {"pass_threshold": 55, "moderate_threshold": 70}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.client.put("/api/settings/", {"pass_threshold": 90}, format="json").status_code, 400)
        res = self.client.post(
            "/api/users/",
            {"email": "new@rdb.rw", "first_name": "New", "last_name": "User", "role": "SUPERVISOR", "password": "longpassword1"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertNotIn("password", res.data)

    def test_dashboard_reports_kpis(self):
        self.client.force_authenticate(self.supervisor)
        self.predict(30)
        res = self.client.get("/api/dashboard/")
        self.assertEqual(res.data["total_workflows"], 1)
        self.assertEqual(res.data["at_risk_workflows"], 1)
        self.assertEqual(res.data["pending_alerts"], 1)
        self.assertEqual(len(res.data["departments"]), 4)


class MlEngineTests(APITestCase):
    def test_predictions_are_bounded_and_monotonic(self):
        low = ml_engine.predict(20, 8)["score"]
        high = ml_engine.predict(90, 8)["score"]
        self.assertTrue(0 <= low < high <= 100)
