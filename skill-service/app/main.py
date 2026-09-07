import secrets
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.registry import execute_skill, list_available_skills


class SkillRequest(BaseModel):
    skill: str = Field(min_length=1, max_length=100)
    role: str = Field(default="user", max_length=30)
    parameters: dict[str, Any] = Field(default_factory=dict)


class SkillResponse(BaseModel):
    success: bool
    skill: str
    result: dict[str, Any]


def verify_internal_key(
    x_leafy_internal_key: str = Header(default=""),
    settings: Settings = Depends(get_settings),
) -> None:
    if not secrets.compare_digest(
        x_leafy_internal_key,
        settings.leafy_internal_key,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Internal service key tidak valid",
        )


app = FastAPI(
    title="Leafy Skill Service",
    version="0.1.0",
)


@app.get("/health")
def health(settings: Settings = Depends(get_settings)):
    return {
        "success": True,
        "service": settings.app_name,
        "environment": settings.app_env,
    }


@app.get(
    "/skills",
    dependencies=[Depends(verify_internal_key)],
)
def get_skills(role: str = "user"):
    return {
        "success": True,
        "role": role,
        "skills": list_available_skills(role),
    }


@app.post(
    "/execute",
    response_model=SkillResponse,
    dependencies=[Depends(verify_internal_key)],
)
def execute(payload: SkillRequest):
    try:
        result = execute_skill(
            skill_name=payload.skill,
            role=payload.role,
            parameters=payload.parameters,
        )

        return SkillResponse(
            success=True,
            skill=payload.skill,
            result=result,
        )
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    except Exception as error:
        print(f"Skill execution error: {error}")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Skill gagal dijalankan",
        ) from error