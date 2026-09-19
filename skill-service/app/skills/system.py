from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict


class ServiceStatusParameters(BaseModel):
    model_config = ConfigDict(extra="forbid")


def service_status() -> dict[str, Any]:
    return {
        "service": "leafy-skill-service",
        "status": "ready",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }