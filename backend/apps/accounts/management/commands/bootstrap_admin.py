from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


ADMIN_EMAIL = "tananya.th@rts2003.co.th"


class Command(BaseCommand):
    help = "Create or restore the initial ASTRO administrator."

    def handle(self, *args, **options):
        User = get_user_model()
        user, created = User.objects.get_or_create(
            email=ADMIN_EMAIL,
            defaults={
                "full_name": "Tananya",
                "role": "admin",
                "is_allowed": True,
                "is_active": True,
                "is_staff": True,
                "is_superuser": True,
            },
        )

        if created:
            user.set_unusable_password()
        else:
            user.role = "admin"
            user.is_allowed = True
            user.is_active = True
            user.is_staff = True
            user.is_superuser = True

        user.save()
        action = "created" if created else "updated"
        self.stdout.write(self.style.SUCCESS(f"Admin {action}: {user.email}"))
