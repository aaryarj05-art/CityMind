import pytest

from app.config.permissions import ALL_PERMISSIONS
from app.dependencies.auth import get_current_user
from app.main import app
from app.models.auth import User
from app.services.auth_service import AuthenticatedUser


@pytest.fixture(autouse=True)
def preserve_legacy_tests_with_demo_admin(request):
    """Existing phase tests exercise business behavior, not auth; real_auth tests do not bypass RBAC."""
    if request.node.get_closest_marker("real_auth"):
        yield
        return
    user = User(
        id=0,
        google_sub="test-suite-demo-admin",
        email="tests@citymind.local",
        name="Test Demo Admin",
        email_verified=True,
        role="DemoAdmin",
        department="Automated Tests",
        is_active=True,
    )
    context = AuthenticatedUser(
        user=user,
        claims={"session_id": "legacy-test-session", "exp": 4102444800},
        permissions=ALL_PERMISSIONS,
    )
    app.dependency_overrides[get_current_user] = lambda: context
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_current_user, None)