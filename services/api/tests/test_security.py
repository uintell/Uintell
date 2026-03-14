from app.services.security import SecurityService


def test_security_service_hashes_and_verifies_password() -> None:
    service = SecurityService(session_ttl_hours=24)
    password_hash = service.hash_password("ChangeMeNow123!")

    assert service.verify_password("ChangeMeNow123!", password_hash) is True
    assert service.verify_password("wrong", password_hash) is False
