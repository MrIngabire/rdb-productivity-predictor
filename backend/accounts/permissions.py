from rest_framework.permissions import BasePermission

from .models import User


class HasRole(BasePermission):
    allowed_roles = ()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in self.allowed_roles)


def roles(*allowed):
    """Build a permission class that only lets the given roles through."""
    return type("RolePermission", (HasRole,), {"allowed_roles": tuple(allowed)})


IsAdminRole = roles(User.Role.ADMIN)
CanInputData = roles(User.Role.ADMIN, User.Role.SUPERVISOR)
CanManageInterventions = roles(User.Role.ADMIN, User.Role.SENIOR_MANAGER)
