from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", User.Role.ADMIN)
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    """Institutional staff account. Sign-in uses the staff email address."""

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "System Administrator"
        SUPERVISOR = "SUPERVISOR", "Supervisor"
        SENIOR_MANAGER = "SENIOR_MANAGER", "Senior Operational Manager"

    username = None
    email = models.EmailField(unique=True)
    title = models.CharField(max_length=20, blank=True, help_text="e.g. Mr., Mrs., Dr.")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.SUPERVISOR)
    job_title = models.CharField(max_length=100, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    @property
    def display_name(self):
        return " ".join(p for p in [self.title, self.first_name, self.last_name] if p) or self.email

    @property
    def initials(self):
        letters = (self.first_name[:1] + self.last_name[:1]).upper()
        return letters or self.email[:2].upper()

    def __str__(self):
        return f"{self.display_name} ({self.get_role_display()})"
