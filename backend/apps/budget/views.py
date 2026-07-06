"""
Budget API (FN-BUD-01..04). Visibility is the heart (PRD §6.11):

  Admin/DM -> full line items incl. rate/salary + category totals + grand total + headcount
  BSA      -> category totals + grand total + headcount (NO rate)
  Dev      -> category totals + grand total only

Editing requires Budget:edit (Admin/DM via the matrix).
"""
import datetime
from collections import defaultdict
from decimal import Decimal

from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status as http
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import HasModulePermission
from apps.common.roles import can_see_money
from apps.projects.models import Project

from .models import CostCategory, CostItem, InfraAsset
from .serializers import CostItemSerializer, CostItemWriteSerializer, InfraAssetSerializer

VAT_NOTE = "ราคายังไม่รวม VAT 7% (สำหรับหมวดที่เกี่ยวข้อง)"
CATEGORY_LABEL = dict(CostCategory.choices)


def _build_budget(project, user):
    items = list(project.cost_items.all())
    see_rate = can_see_money(user)  # Admin/DM
    show_headcount = user.role in ("admin", "dm", "bsa")

    by_cat_total = defaultdict(Decimal)
    by_cat_items = defaultdict(list)
    headcount = Decimal("0")
    grand = Decimal("0")
    for it in items:
        by_cat_total[it.category] += it.total
        grand += it.total
        by_cat_items[it.category].append(it)
        if it.category == "manpower":
            headcount += it.qty_or_units or 0

    categories = []
    for cat, _label in CostCategory.choices:
        if cat not in by_cat_total and cat != "manpower":
            continue
        entry = {
            "category": cat,
            "category_label": CATEGORY_LABEL[cat],
            "total": str(by_cat_total.get(cat, Decimal("0"))),
        }
        if cat == "manpower" and show_headcount:
            # Clean integer-ish string (2.00 -> "2", 2.50 -> "2.5").
            entry["headcount"] = f"{headcount.normalize():f}" if headcount else "0"
        if see_rate:
            entry["items"] = CostItemSerializer(by_cat_items.get(cat, []), many=True).data
        categories.append(entry)

    return {
        "categories": categories,
        "grand_total": str(grand),
        "can_see_rate": see_rate,
        "show_headcount": show_headcount,
        "vat_note": VAT_NOTE,
    }


class BudgetView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = "Budget"

    def get(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        return Response(_build_budget(project, request.user))


class CostItemCreateView(generics.CreateAPIView):
    serializer_class = CostItemWriteSerializer
    permission_classes = [HasModulePermission]
    permission_module = "Budget"
    permission_action_map = {"POST": "create"}

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs["pk"])
        serializer.save(project=project)


class CostItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CostItemWriteSerializer
    permission_classes = [HasModulePermission]
    permission_module = "Budget"
    permission_action_map = {"GET": "view", "PATCH": "edit", "PUT": "edit", "DELETE": "delete"}
    queryset = CostItem.objects.all()


EXPIRING_WINDOW_DAYS = 30


class InfraAssetListCreateView(APIView):
    """
    GET/POST /api/infra — ทะเบียนทรัพยากรจริงทุกโครงการ (Infrastructure
    dashboard + budget-tab actuals via ?project=). Module "Budget": ทุก role
    เห็นว่าอะไรอยู่ที่ไหน (view); Admin/DM จัดการ + เห็นราคา.
    """

    permission_classes = [HasModulePermission]
    permission_module = "Budget"
    permission_action_map = {"GET": "view", "POST": "create"}

    def get(self, request):
        qs = InfraAsset.objects.select_related("project")
        p = request.query_params
        if p.get("project"):
            qs = qs.filter(project_id=p["project"])
        if p.get("type"):
            qs = qs.filter(asset_type=p["type"])
        if p.get("environment"):
            qs = qs.filter(environment=p["environment"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("search"):
            s = p["search"]
            qs = qs.filter(
                Q(name__icontains=s)
                | Q(provider__icontains=s)
                | Q(location__icontains=s)
                | Q(project__project_name__icontains=s)
            )
        assets = list(qs)

        today = datetime.date.today()
        horizon = today + datetime.timedelta(days=EXPIRING_WINDOW_DAYS)
        active = [a for a in assets if a.status == "active"]
        expiring = [
            a.id for a in active if a.expires_at and today <= a.expires_at <= horizon
        ]
        expired = [a.id for a in active if a.expires_at and a.expires_at < today]

        summary = {
            "total": len(assets),
            "active": len(active),
            "expiring_soon": expiring,   # ids — frontend highlights the rows
            "expired": expired,
            "window_days": EXPIRING_WINDOW_DAYS,
        }
        if can_see_money(request.user):
            summary["monthly_cost_total"] = str(
                sum((a.monthly_cost() for a in active), Decimal("0")).quantize(Decimal("0.01"))
            )
            summary["one_time_total"] = str(
                sum((a.cost or Decimal("0") for a in active if a.billing_cycle == "one_time"), Decimal("0"))
            )

        return Response(
            {
                "summary": summary,
                "assets": InfraAssetSerializer(assets, many=True, context={"request": request}).data,
            }
        )

    def post(self, request):
        ser = InfraAssetSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        asset = ser.save(created_by=request.user)
        return Response(
            InfraAssetSerializer(asset, context={"request": request}).data,
            status=http.HTTP_201_CREATED,
        )


class InfraAssetDetailView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = "Budget"
    permission_action_map = {"PATCH": "edit", "DELETE": "delete"}

    def patch(self, request, pk):
        asset = get_object_or_404(InfraAsset, pk=pk)
        ser = InfraAssetSerializer(asset, data=request.data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk):
        asset = get_object_or_404(InfraAsset, pk=pk)
        asset.delete()
        return Response(status=http.HTTP_204_NO_CONTENT)


class BudgetExportView(APIView):
    """FN-BUD-04 — export to .xlsx (line items if Admin/DM, else totals)."""

    permission_classes = [HasModulePermission]
    permission_module = "Budget"

    def get(self, request, pk):
        import openpyxl

        project = get_object_or_404(Project, pk=pk)
        data = _build_budget(project, request.user)
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Budget"
        ws.append([f"งบประมาณ: {project.project_name}"])

        if data["can_see_rate"]:
            ws.append(["หมวด", "รายการ", "จำนวน", "เดือน", "Rate", "รวม", "Outsource", "หมายเหตุ"])
            for cat in data["categories"]:
                for it in cat.get("items", []):
                    ws.append([
                        cat["category_label"], it["label"], it["qty_or_units"],
                        it["months"], it["rate"], it["total"],
                        "ใช่" if it["is_outsource"] else "", it["note"],
                    ])
        else:
            ws.append(["หมวด", "ยอดรวม"])
            for cat in data["categories"]:
                ws.append([cat["category_label"], cat["total"]])

        ws.append([])
        ws.append(["Grand Total", data["grand_total"]])
        ws.append([data["vat_note"]])

        resp = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        resp["Content-Disposition"] = f'attachment; filename="budget_{project.id}.xlsx"'
        wb.save(resp)
        return resp
