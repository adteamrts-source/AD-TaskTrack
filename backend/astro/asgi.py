"""
ASGI config for astro project.

Channels-enabled ASGI application that routes HTTP traffic to Django and
WebSocket traffic through AuthMiddlewareStack for authenticated consumers.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'astro.settings.prod')

# Initialise Django before importing anything that touches models/settings.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.auth import AuthMiddlewareStack              # noqa: E402
from channels.generic.websocket import AsyncWebsocketConsumer  # noqa: E402


class EchoConsumer(AsyncWebsocketConsumer):
    """Placeholder WebSocket consumer — replace with real consumers as needed."""

    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data=None, bytes_data=None):
        if text_data is not None:
            await self.send(text_data=text_data)


application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter([
            # Register WebSocket URL routes here, e.g.:
            # path("ws/tasks/", consumers.TaskConsumer.as_asgi()),
        ])
    ),
})
