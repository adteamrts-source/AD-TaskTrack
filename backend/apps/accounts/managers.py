from django.contrib.auth.models import BaseUserManager


class UserManager(BaseUserManager):
    """Email-based user manager (no username field)."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("ต้องระบุอีเมล")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", "dev")
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        extra.setdefault("is_allowed", True)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        # First Admin is bootstrapped via createsuperuser (PRD §6.1).
        extra.setdefault("role", "admin")
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("is_allowed", True)
        if extra["is_staff"] is not True:
            raise ValueError("superuser ต้องมี is_staff=True")
        if extra["is_superuser"] is not True:
            raise ValueError("superuser ต้องมี is_superuser=True")
        return self._create_user(email, password, **extra)
