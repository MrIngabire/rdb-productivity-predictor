import random
from datetime import datetime, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from productivity import ml_engine, services
from productivity.models import Department, EngineSettings, Employee, PredictionAlert

FIRST = ["Aline", "Eric", "Grace", "Patrick", "Diane", "Claude", "Sandrine", "Olivier", "Chantal", "Fabrice",
         "Josiane", "Emmanuel", "Claudine", "Innocent", "Vestine", "Theogene", "Mireille", "Jean Claude", "Alice", "Bosco"]
LAST = ["Uwimana", "Habimana", "Mukamana", "Niyonzima", "Uwase", "Nsengiyumva", "Ingabire", "Mugisha",
        "Kamanzi", "Ishimwe", "Nkurunziza", "Mutesi", "Bizimana", "Iradukunda", "Munyaneza", "Tuyishime"]
TASKS = {
    Department.BUSINESS_REGISTRATION: ["Company Registration Queue", "Certificate Issuance Audit", "Name Reservation Review"],
    Department.INVESTMENT_PROMOTION: ["Q3 Investor Audit", "Investor Inquiry Resolution", "Project Monitoring & Evaluation"],
    Department.DIGITAL_SERVICES: ["Portal Uptime Review", "e-Service Ticket Backlog", "Integration Rollout"],
    Department.ENTERPRISE_DEVELOPMENT: ["SME Onboarding Log", "Training Cohort Delivery", "Access-to-Finance Follow-up"],
}
# Mean completion rate per department; Digital Services is deliberately the struggling one.
MEAN = {
    Department.BUSINESS_REGISTRATION: 68,
    Department.INVESTMENT_PROMOTION: 74,
    Department.DIGITAL_SERVICES: 46,
    Department.ENTERPRISE_DEVELOPMENT: 80,
}


class Command(BaseCommand):
    help = "Create demo users, workflow profiles, operational records, predictions and alerts."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=120, help="Extra random workflow profiles to create")

    def handle(self, *args, **opts):
        rng = random.Random(2026)
        now = timezone.now()
        EngineSettings.load()
        ml_engine.train_and_save()

        def user(email, first, last, title, role, job, staff=False):
            u, created = User.objects.get_or_create(
                email=email,
                defaults=dict(first_name=first, last_name=last, title=title, role=role, job_title=job, is_staff=staff),
            )
            if created:
                u.set_password("password123")
                u.save()
            return u

        admin = user("admin@rdb.rw", "Emmanuel", "Manyange", "Mr.", User.Role.ADMIN, "Senior Administrator", staff=True)
        admin.is_superuser = True
        admin.save()
        user("supervisor@rdb.rw", "Aline", "Mukamana", "Ms.", User.Role.SUPERVISOR, "Operations Supervisor")
        senior = user("manager@rdb.rw", "Patrick", "Nsengiyumva", "Mr.", User.Role.SENIOR_MANAGER, "Senior Operational Manager")

        if Employee.objects.exists():
            self.stdout.write(self.style.WARNING("Profiles already exist; users ensured, skipping profile seed."))
            return

        # Profiles featured in the prototype screenshots (tickets #ALT-801 and #ALT-802).
        jp = Employee.objects.create(employee_id="RDB-2024-8932", full_name="Jean Paul Uwase",
                                     department=Department.INVESTMENT_PROMOTION, attendance_rate=82)
        services.run_prediction(jp, "Q3 Investor Audit", 62, 8, recorded_at=timezone.make_aware(datetime(2026, 9, 15, 10)), auto_escalate=False)
        services.run_prediction(jp, "SME Onboarding Log", 45, 7.5, recorded_at=timezone.make_aware(datetime(2026, 10, 2, 10)))

        eric = Employee.objects.create(employee_id="RDB-2024-5120", full_name="Ganza Eric",
                                       department=Department.BUSINESS_REGISTRATION, attendance_rate=76)
        services.run_prediction(eric, "Company Registration Queue", 58, 8, recorded_at=now - timedelta(days=40), auto_escalate=False)
        services.run_prediction(eric, "Certificate Issuance Audit", 41, 6.5, recorded_at=now - timedelta(days=9))

        depts = list(Department.values)
        for i in range(opts["count"]):
            dept = depts[i % len(depts)]
            emp = Employee.objects.create(
                employee_id=f"RDB-2024-{1000 + i:04d}",
                full_name=f"{rng.choice(FIRST)} {rng.choice(LAST)}",
                department=dept,
                attendance_rate=round(rng.uniform(70, 99), 1),
            )
            n = rng.randint(2, 4)
            for step in range(n):
                completion = max(8, min(100, rng.gauss(MEAN[dept], 13)))
                hours = max(4, min(11, rng.gauss(7.6, 1.2)))
                last = step == n - 1
                services.run_prediction(
                    emp, rng.choice(TASKS[dept]), round(completion, 1), round(hours, 1),
                    recorded_at=now - timedelta(days=(n - step) * 14 + rng.randint(0, 5)),
                    auto_escalate=last,
                )

        # Make the queue look lived-in: resolve/progress some random tickets, keep the two featured ones pending.
        featured = {"RDB-2024-8932", "RDB-2024-5120"}
        for alert in PredictionAlert.objects.filter(escalated=True).exclude(employee__employee_id__in=featured):
            roll = rng.random()
            if roll < 0.4:
                alert.status, alert.assigned_to = PredictionAlert.Status.RESOLVED, senior
            elif roll < 0.65:
                alert.status, alert.assigned_to = PredictionAlert.Status.IN_PROGRESS, senior
            alert.save()

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {Employee.objects.count()} profiles, {PredictionAlert.objects.filter(escalated=True).count()} tickets. "
            "Logins (password123): admin@rdb.rw, supervisor@rdb.rw, manager@rdb.rw"
        ))
