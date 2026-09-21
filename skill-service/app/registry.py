from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, ValidationError

from app.skills.client_imports import (
    ConfirmClientImportParameters,
    confirm_client_import,
)

from app.skills.finance import (
    ConfirmVoidFinanceTransactionParameters,
    GetFinanceSummaryParameters,
    GetFinanceTransactionParameters,
    ListFinanceCategoriesParameters,
    ListFinanceTransactionsParameters,
    PreviewVoidFinanceTransactionParameters,
    RecordFinanceTransactionParameters,
    confirm_void_finance_transaction,
    get_finance_summary,
    get_finance_transaction,
    list_finance_categories,
    list_finance_transactions,
    preview_void_finance_transaction,
    record_expense,
    record_income,
)

from app.skills.database import (
    CountRowsParameters,
    DescribeTableParameters,
    ListTablesParameters,
    ReadTableParameters,
    count_rows,
    describe_table,
    list_tables,
    read_table,
)
from app.skills.system import (
    ServiceStatusParameters,
    service_status,
)
from app.skills.clients import (
    CreateClientParameters,
    GetClientParameters,
    ListClientsParameters,
    UpdateClientParameters,
    UpdateClientStatusParameters,
    ConfirmDeleteClientParameters,
    PreviewDeleteClientParameters,
    confirm_delete_client,
    preview_delete_client,
    create_client,
    get_client,
    list_clients,
    update_client,
    update_client_status,
)

from app.skills.outreach import (
    FindFollowupsParameters,
    RecordOutreachParameters,
    find_followups,
    record_outreach,
)

from app.skills.business_summary import (
    DailyBusinessSummaryParameters,
    get_daily_business_summary,
)

from app.skills.documents import (
    DeleteDocumentParameters,
    GetDocumentParameters,
    ListDocumentsParameters,
    SearchKnowledgeParameters,
    delete_document,
    get_document,
    list_documents,
    search_knowledge,
)


SkillHandler = Callable[..., dict[str, Any]]


class UnknownSkillError(Exception):
    pass


class InvalidSkillParametersError(Exception):
    pass


SKILL_REGISTRY: dict[str, dict[str, Any]] = {

    "delete_document": {
        "handler": delete_document,
        "parameter_model": DeleteDocumentParameters,
        "description": (
            "Menghapus dokumen knowledge berdasarkan "
            "kode singkat, kode internal, atau nama file"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
        "inject_actor": True,
    },

    "list_documents": {
        "handler": list_documents,
        "parameter_model": ListDocumentsParameters,
        "description": (
            "Menampilkan daftar dokumen perusahaan "
            "yang telah diproses"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },

    "get_document": {
        "handler": get_document,
        "parameter_model": GetDocumentParameters,
        "description": (
            "Menampilkan detail dokumen berdasarkan "
            "document_code"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },

    "search_knowledge": {
        "handler": search_knowledge,
        "parameter_model": SearchKnowledgeParameters,
        "description": (
            "Mencari informasi relevan dalam dokumen "
            "perusahaan yang telah diproses"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    
    "get_daily_business_summary": {
        "handler": get_daily_business_summary,
        "parameter_model":
            DailyBusinessSummaryParameters,
        "description": (
            "Menampilkan ringkasan operasional dan "
            "keuangan bisnis untuk satu tanggal"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    
    "get_finance_transaction": {
        "handler": get_finance_transaction,
        "parameter_model":
            GetFinanceTransactionParameters,
        "description": (
            "Menampilkan detail satu transaksi keuangan"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },

    "preview_void_finance_transaction": {
        "handler": preview_void_finance_transaction,
        "parameter_model":
            PreviewVoidFinanceTransactionParameters,
        "description": (
            "Membuat preview pembatalan transaksi keuangan"
        ),
        "roles": {"superadmin"},
        "inject_role": True,
        "inject_actor": True,
    },

    "confirm_void_finance_transaction": {
        "handler": confirm_void_finance_transaction,
        "parameter_model":
            ConfirmVoidFinanceTransactionParameters,
        "description": (
            "Mengonfirmasi pembatalan transaksi keuangan"
        ),
        "roles": {"superadmin"},
        "inject_role": True,
        "inject_actor": True,
    },
    
    "list_finance_categories": {
        "handler": list_finance_categories,
        "parameter_model":
            ListFinanceCategoriesParameters,
        "description": (
            "Menampilkan kategori pemasukan "
            "dan pengeluaran yang tersedia"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },

    "record_income": {
        "handler": record_income,
        "parameter_model":
            RecordFinanceTransactionParameters,
        "description": (
            "Mencatat transaksi pemasukan bisnis"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
        "inject_actor": True,
    },

    "record_expense": {
        "handler": record_expense,
        "parameter_model":
            RecordFinanceTransactionParameters,
        "description": (
            "Mencatat transaksi pengeluaran bisnis"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
        "inject_actor": True,
    },

    "list_finance_transactions": {
        "handler": list_finance_transactions,
        "parameter_model":
            ListFinanceTransactionsParameters,
        "description": (
            "Menampilkan transaksi keuangan "
            "berdasarkan filter"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },

    "get_finance_summary": {
        "handler": get_finance_summary,
        "parameter_model":
            GetFinanceSummaryParameters,
        "description": (
            "Menghitung pemasukan, pengeluaran, "
            "dan arus kas bersih"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    
    "confirm_client_import": {
    "handler": confirm_client_import,
    "parameter_model": ConfirmClientImportParameters,
    "description": (
        "Mengonfirmasi impor klien dari file XLSX atau CSV"
    ),
    "roles": {"superadmin"},
    "inject_role": True,
    "inject_actor": True,
},
    
    "record_outreach": {
        "handler": record_outreach,
        "parameter_model": RecordOutreachParameters,
        "description": (
            "Mencatat aktivitas outreach dan "
            "memperbarui status klien otomatis"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },

    "find_followups": {
        "handler": find_followups,
        "parameter_model": FindFollowupsParameters,
        "description": (
            "Menampilkan klien dengan jadwal "
            "follow-up yang sudah jatuh tempo"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    
    "preview_delete_client": {
        "handler": preview_delete_client,
        "parameter_model": PreviewDeleteClientParameters,
        "description": (
            "Membuat preview dan konfirmasi sementara "
            "untuk penghapusan klien"
        ),
        "roles": {"superadmin"},
        "inject_role": True,
        "inject_actor": True,
    },

    "confirm_delete_client": {
        "handler": confirm_delete_client,
        "parameter_model": ConfirmDeleteClientParameters,
        "description": (
            "Mengonfirmasi penghapusan klien "
            "menggunakan token sementara"
        ),
        "roles": {"superadmin"},
        "inject_role": True,
        "inject_actor": True,
    },
        
    "update_client": {
        "handler": update_client,
        "parameter_model": UpdateClientParameters,
        "description": (
            "Memperbarui profil klien berdasarkan client_id"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },

    "update_client_status": {
        "handler": update_client_status,
        "parameter_model": UpdateClientStatusParameters,
        "description": (
            "Memperbarui status klien berdasarkan client_id"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    
    "create_client": {
        "handler": create_client,
        "parameter_model": CreateClientParameters,
        "description": (
            "Membuat data klien baru dengan client_code unik"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    
    "describe_table": {
        "handler": describe_table,
        "parameter_model": DescribeTableParameters,
        "description": "Menampilkan struktur tabel terdaftar",
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    "read_table": {
        "handler": read_table,
        "parameter_model": ReadTableParameters,
        "description": "Membaca data dari tabel terdaftar",
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    "count_rows": {
        "handler": count_rows,
        "parameter_model": CountRowsParameters,
        "description": "Menghitung jumlah baris tabel terdaftar",
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    
    "list_clients": {
        "handler": list_clients,
        "parameter_model": ListClientsParameters,
        "description": (
            "Menampilkan daftar klien dengan filter "
            "pencarian, status, dan kota"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
        
    "get_client": {
        "handler": get_client,
        "parameter_model": GetClientParameters,
        "description": (
            "Menampilkan detail satu klien "
            "berdasarkan client_id"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    
    "service_status": {
        "handler": service_status,
        "parameter_model": ServiceStatusParameters,
        "description": "Memeriksa status Python skill service",
        "roles": {"user", "admin", "superadmin"},
        "inject_role": False,
    },
    "list_tables": {
        "handler": list_tables,
        "parameter_model": ListTablesParameters,
        "description": "Menampilkan tabel dari database terdaftar",
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
}


def list_available_skills(role: str) -> list[dict[str, str]]:
    normalized_role = normalize_role(role)
    available_skills: list[dict[str, str]] = []

    for name, skill in SKILL_REGISTRY.items():
        if normalized_role in skill["roles"]:
            available_skills.append(
                {
                    "name": name,
                    "description": skill["description"],
                }
            )

    return available_skills

def normalize_role(role: str) -> str:
    allowed_roles = {"user", "admin", "superadmin"}
    normalized_role = role.strip().lower()

    if normalized_role not in allowed_roles:
        raise PermissionError

    return normalized_role

def execute_skill(
    skill_name: str,
    role: str,
    parameters: dict[str, Any],
    actor_id: str | None = None,
) -> dict[str, Any]:
    normalized_role = normalize_role(role)
    skill = SKILL_REGISTRY.get(skill_name)

    if skill is None:
        raise UnknownSkillError

    if normalized_role not in skill["roles"]:
        raise PermissionError

    parameter_model: type[BaseModel] = skill[
        "parameter_model"
    ]

    try:
        validated = parameter_model.model_validate(
            parameters
        )
    except ValidationError as error:
        raise InvalidSkillParametersError from error

    handler: SkillHandler = skill["handler"]
    handler_parameters = validated.model_dump()

    if skill.get("inject_role", False):
        handler_parameters["role"] = normalized_role

    if skill.get("inject_actor", False):
        if actor_id is None:
            raise InvalidSkillParametersError

        handler_parameters["actor_id"] = actor_id

    return handler(**handler_parameters)
