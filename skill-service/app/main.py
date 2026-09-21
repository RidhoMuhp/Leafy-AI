import logging
import secrets
from typing import Any, Literal

from fastapi import (Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,)
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, ConfigDict, Field
from app.skills.clients import (
    ClientAlreadyExistsError,
    ClientNotFoundError,
    ClientDeleteRestrictedError,
    InvalidConfirmationError,
    
)

from app.config import Settings, get_settings
from app.registry import (
    InvalidSkillParametersError,
    UnknownSkillError,
    execute_skill,
    list_available_skills,
)
from app.database.errors import (
    
    DatabaseAccessDeniedError,
    DatabaseConfigurationError,
    DatabaseConnectionError,
    TableAccessDeniedError,
    UnknownDatabaseError,
    UnknownTableError,
)
from app.skills.client_imports import (
    ClientImportConfirmationError,
    InvalidClientImportFileError,
    MAX_FILE_SIZE,
    preview_client_import,
)

from app.skills.finance import (
    FinanceCategoryNotFoundError,
    FinanceCategoryTypeMismatchError,
    FinanceTransactionAlreadyVoidError,
    FinanceTransactionNotFoundError,
    FinanceVoidConfirmationError,
)

from app.skills.document_ingestion import (
    DocumentExtractionError,
    DuplicateDocumentError,
    InvalidDocumentFileError,
    MAX_DOCUMENT_FILE_SIZE,
    ingest_document,
)

from app.skills.documents import (
    AmbiguousDocumentReferenceError,
    DocumentAccessDeniedError,
    DocumentNotFoundError,
)

logger = logging.getLogger(__name__)

internal_key_header = APIKeyHeader(
    name="x-leafy-internal-key",
    auto_error=False,
)


class SkillRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skill: str = Field(min_length=1, max_length=100)
    role: Literal["user", "admin", "superadmin"] = "user"
    actor_id: str | None = Field(
        default=None,
        pattern=r"^[a-f0-9]{64}$",
    )
    parameters: dict[str, Any] = Field(default_factory=dict)


class SkillResponse(BaseModel):
    success: bool
    skill: str
    result: dict[str, Any]


def verify_internal_key(
    provided_key: str | None = Depends(internal_key_header),
    settings: Settings = Depends(get_settings),
) -> None:
    if provided_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Internal service key tidak valid",
        )

    if not secrets.compare_digest(
        provided_key,
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
    try:
        skills = list_available_skills(role)

    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role tidak diizinkan",
        ) from error

    return {
        "success": True,
        "role": role,
        "skills": skills,
    }
@app.post(
    "/imports/clients/preview",
    dependencies=[Depends(verify_internal_key)],
)
async def preview_clients_import(
    file: UploadFile = File(...),
    role: Literal[
        "user",
        "admin",
        "superadmin",
    ] = Form(...),
    actor_id: str = Form(...),
    database_id: str = Form(...),
):
    try:
        if len(actor_id) != 64:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Actor ID tidak valid",
            )

        file_name = file.filename or ""

        file_content = await file.read(
            MAX_FILE_SIZE + 1
        )

        result = preview_client_import(
            role=role,
            actor_id=actor_id,
            database_id=database_id,
            file_name=file_name,
            mime_type=(
                file.content_type
                or "application/octet-stream"
            ),
            file_content=file_content,
        )

        return {
            "success": True,
            "operation": "preview_client_import",
            "result": result,
        }

    except InvalidClientImportFileError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error

    except UnknownDatabaseError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database tidak terdaftar",
        ) from error

    except DatabaseAccessDeniedError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses database ditolak",
        ) from error

    except TableAccessDeniedError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses tabel ditolak",
        ) from error

    except DatabaseConfigurationError as error:
        logger.exception(
            "Client import database configuration invalid"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Konfigurasi database tidak tersedia",
        ) from error

    except DatabaseConnectionError as error:
        logger.exception(
            "Client import database connection failed"
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database tidak dapat diakses",
        ) from error

    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses impor klien ditolak",
        ) from error

    except HTTPException:
        raise

    except Exception as error:
        logger.exception("Client import preview failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Preview impor klien gagal",
        ) from error

    finally:
        await file.close()

@app.post(
    "/documents/ingest",
    dependencies=[Depends(verify_internal_key)],
)
async def ingest_knowledge_document(
    file: UploadFile = File(...),
    role: Literal[
        "user",
        "admin",
        "superadmin",
    ] = Form(...),
    database_id: str = Form(...),
    actor_id: str = Form(
        min_length=64,
        max_length=64,
        pattern=r"^[a-f0-9]{64}$",
    ),
    message_timestamp: str | None = Form(
        default=None,
        max_length=64,
),
):
    try:
        file_name = file.filename or ""

        file_content = await file.read(
            MAX_DOCUMENT_FILE_SIZE + 1
        )

        result = ingest_document(
            role=role,
            actor_id=actor_id,
            database_id=database_id,
            file_name=file.filename or "document",
            supplied_mime_type=(
                file.content_type
                or "application/octet-stream"
            ),
            file_content=file_content,
            message_timestamp=message_timestamp,
        )

        return {
            "success": True,
            "operation": "ingest_document",
            "result": result,
        }

    except InvalidDocumentFileError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error

    except DocumentExtractionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error

    except DuplicateDocumentError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Dokumen yang sama sudah tersedia",
        ) from error

    except UnknownDatabaseError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database tidak terdaftar",
        ) from error

    except UnknownTableError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tabel dokumen tidak terdaftar",
        ) from error

    except DatabaseAccessDeniedError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses database ditolak",
        ) from error

    except TableAccessDeniedError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses tabel dokumen ditolak",
        ) from error

    except DatabaseConfigurationError as error:
        logger.exception(
            "Document database configuration invalid"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Konfigurasi database tidak tersedia",
        ) from error

    except DatabaseConnectionError as error:
        logger.exception(
            "Document database connection failed"
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database tidak dapat diakses",
        ) from error

    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ingestion dokumen ditolak",
        ) from error

    except HTTPException:
        raise

    except Exception as error:
        logger.exception(
            "Document ingestion failed"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Dokumen gagal diproses",
        ) from error

    finally:
        await file.close()

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
            actor_id=payload.actor_id,
            parameters=payload.parameters,
        )

        return SkillResponse(
            success=True,
            skill=payload.skill,
            result=result,
        )
    except ClientImportConfirmationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Konfirmasi impor tidak valid "
                "atau sudah kedaluwarsa"
            ),
        ) from error
        

    except UnknownSkillError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skill tidak terdaftar",
        ) from error

    except InvalidSkillParametersError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Parameter skill tidak valid",
        ) from error
        
    except UnknownDatabaseError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database tidak terdaftar",
        ) from error

    except DatabaseAccessDeniedError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses database ditolak",
        ) from error
        
    except UnknownTableError as error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tabel tidak terdaftar",
            ) from error
    
    except TableAccessDeniedError as error:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akses tabel ditolak",
            ) from error

    except DatabaseConfigurationError as error:
        logger.exception("Database configuration invalid")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Konfigurasi database tidak tersedia",
        ) from error

    except DatabaseConnectionError as error:
        logger.exception("Database connection failed")

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database tidak dapat diakses",
        ) from error
        
    except ClientNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Klien tidak ditemukan",
        ) from error
        
    except DocumentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokumen tidak ditemukan",
        ) from error   

    except DocumentAccessDeniedError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Anda tidak memiliki izin untuk "
                "menghapus dokumen tersebut"
            ),
        ) from error

    except AmbiguousDocumentReferenceError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    "Nama dokumen tidak unik. "
                    "Gunakan kode dokumen."
                ),
                "matches": error.matches,
            },
        ) from error
        
    except ClientDeleteRestrictedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Klien memiliki riwayat outreach "
                "dan tidak dapat dihapus"
            ),
        ) from error

    except InvalidConfirmationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Konfirmasi penghapusan tidak valid "
                "atau sudah kedaluwarsa"
            ),
        ) from error
        
    except FinanceCategoryNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kategori keuangan tidak ditemukan",
        ) from error

    except FinanceCategoryTypeMismatchError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Kategori tidak sesuai dengan "
                "jenis transaksi"
            ),
        ) from error
    except FinanceTransactionNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaksi keuangan tidak ditemukan",
        ) from error

    except FinanceTransactionAlreadyVoidError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transaksi keuangan sudah dibatalkan",
        ) from error

    except FinanceVoidConfirmationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Konfirmasi pembatalan transaksi tidak valid "
                "atau sudah kedaluwarsa"
            ),
        ) from error

    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses skill ditolak",
        ) from error
            
    except ClientAlreadyExistsError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Kode klien sudah digunakan",
        ) from error

    except Exception as error:
        logger.exception("Skill execution failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Skill gagal dijalankan",
        ) from error
