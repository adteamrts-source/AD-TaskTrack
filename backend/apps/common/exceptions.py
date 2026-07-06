"""
Custom DRF exception handler so business-rule conflicts surface as 409.

Error shapes follow Functions Design §2.3 (400/401/403/404/409). Raise
`Conflict` for business collisions such as claiming an already-claimed task.
"""
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


class Conflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "เกิดความขัดแย้งของข้อมูล"
    default_code = "conflict"


def astro_exception_handler(exc, context):
    """Delegate to DRF's handler; kept as a hook for future shaping."""
    return exception_handler(exc, context)
