from datetime import datetime, timezone
from typing import Any


def service_status(**_: Any) -> dict[str, Any]:
    return {
        "service": "leafy-skill-service",
        "status": "ready",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }