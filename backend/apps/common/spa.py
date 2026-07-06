"""Serve the built React SPA index.html for all client-side routes."""
from django.http import HttpResponse
from django.views.decorators.cache import never_cache

_DEV_PLACEHOLDER = """<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8"><title>ASTRO</title></head>
<body style="font-family:system-ui;background:#f8fafc;color:#1e293b;padding:40px">
  <h1>ASTRO</h1>
  <p>ยังไม่ได้ build frontend. ระหว่างพัฒนาให้รัน Vite dev server:</p>
  <pre>cd frontend &amp;&amp; npm run dev</pre>
  <p>แล้วเปิด <a href="http://localhost:5173">http://localhost:5173</a> (proxy ไป /api).</p>
  <p>สำหรับ production: <code>npm run build</code> + <code>manage.py collectstatic</code>.</p>
</body></html>"""


@never_cache
def spa_index(request):
    """
    Return the built SPA shell. Falls back to a dev placeholder until the
    frontend has been built into staticfiles (Phase 0 integration step).
    """
    from django.contrib.staticfiles import finders

    index = finders.find("index.html")
    if index:
        with open(index, "r", encoding="utf-8") as fh:
            return HttpResponse(fh.read())
    return HttpResponse(_DEV_PLACEHOLDER)
