"""Client Master API (FN-CLI-01..04)."""
from django.db.models import Q
from rest_framework import generics

from apps.common.permissions import HasModulePermission

from .models import Client
from .serializers import ClientSerializer


class ClientListCreateView(generics.ListCreateAPIView):
    serializer_class = ClientSerializer
    permission_classes = [HasModulePermission]
    permission_module = "Client Master"

    def get_queryset(self):
        qs = Client.objects.all()
        search = self.request.query_params.get("search")
        active = self.request.query_params.get("active")
        if search:
            qs = qs.filter(
                Q(client_name__icontains=search)
                | Q(client_abbreviation__icontains=search)
            )
        if active in ("true", "false"):
            qs = qs.filter(is_active=(active == "true"))
        elif active is None:
            # Dropdowns default to active clients only (FN-CLI-03).
            qs = qs.filter(is_active=True)
        return qs


class ClientDetailView(generics.RetrieveUpdateAPIView):
    """Edit active status/details from the frontend Client Master screen."""

    serializer_class = ClientSerializer
    permission_classes = [HasModulePermission]
    permission_module = "Client Master"
    queryset = Client.objects.all()
    http_method_names = ["get", "patch", "put", "head", "options"]
