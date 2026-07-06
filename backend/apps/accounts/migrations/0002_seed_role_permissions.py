from django.db import migrations


def seed(apps, schema_editor):
    RolePermission = apps.get_model("accounts", "RolePermission")
    from apps.accounts.permissions_seed import seed_role_permissions

    seed_role_permissions(model=RolePermission)


def unseed(apps, schema_editor):
    RolePermission = apps.get_model("accounts", "RolePermission")
    RolePermission.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
