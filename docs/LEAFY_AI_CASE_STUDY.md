# Leafy AI — Secure WhatsApp Data Assistant

## Project Overview

Leafy AI adalah asisten data berbasis WhatsApp yang memungkinkan pengguna mengakses dan mengelola data bisnis menggunakan bahasa alami.

Sistem menerima perintah melalui WhatsApp, memahami maksud pengguna dengan bantuan LLM, memvalidasi izin dan parameter pada backend, lalu menjalankan skill yang sudah ditulis dan dibatasi oleh developer.

Project ini dikembangkan sebagai fondasi asisten operasional bisnis yang aman, terstruktur, dan dapat dikembangkan untuk kebutuhan CRM, administrasi, outreach, dokumen, serta knowledge management.

## Problem

Banyak proses administrasi bisnis masih membutuhkan pengguna untuk:

* Membuka dashboard.
* Mencari menu tertentu.
* Menyusun filter secara manual.
* Membaca tabel database.
* Memindahkan data dari percakapan ke sistem.
* Menghubungi calon klien dan mencatat aktivitas secara terpisah.

Leafy AI dirancang agar aktivitas tersebut dapat dilakukan melalui perintah WhatsApp yang sederhana, tanpa memberikan akses SQL langsung kepada pengguna maupun AI.

Contoh:

> Tampilkan semua calon klien di Makassar dengan status lead.

Leafy AI akan memilih skill yang sesuai, memvalidasi akses pengguna, mengambil data melalui backend, dan mengirimkan hasilnya kembali dalam format WhatsApp yang mudah dibaca.

## Current Architecture

```text
WhatsApp
    ↓
Node.js Orchestrator
    ↓
Groq Planner
    ↓
Role, skill, and parameter validation
    ↓
FastAPI Skill Service
    ↓
Developer-controlled parameterized SQL
    ↓
MySQL
    ↓
Structured JSON result
    ↓
Groq Formatter
    ↓
Natural WhatsApp response
```

## Technology Stack

### Orchestrator

* Node.js
* Express
* CommonJS
* Axios
* Groq SDK

### WhatsApp Integration

* Baileys
* Multi-device authentication
* PN JID and LID identity handling
* Typing indicator
* Private-message processing

### Skill Service

* Python
* FastAPI
* Pydantic
* SQLAlchemy
* PyMySQL
* Uvicorn

### Database

* MySQL
* XAMPP local environment
* Parameterized queries
* Registered database aliases
* Table allowlist

### AI

* Groq
* `openai/gpt-oss-120b`
* Structured JSON planning
* Natural-language response formatting

## Security Design

Leafy AI menggunakan prinsip bahwa LLM tidak boleh menjadi sumber otorisasi dan tidak boleh menjalankan SQL.

Aturan keamanan utama:

* Groq hanya memilih skill dan parameter.
* Groq tidak membuat atau mengeksekusi SQL.
* SQL hanya ditulis dalam Python skill oleh developer.
* Query data menggunakan parameterized SQL.
* Database dipilih melalui alias yang terdaftar.
* Tabel hanya dapat diakses melalui table registry.
* Role pengguna ditentukan oleh backend.
* Prompt tidak dapat meningkatkan role pengguna.
* Parameter tambahan ditolak secara default.
* Raw SQL dan connection string ditolak.
* Internal service menggunakan API key terpisah.
* Credential database hanya tersedia pada Python skill service.
* Node.js tidak memiliki akses langsung ke MySQL.
* Error internal tidak dikirimkan kepada pengguna.
* Operasi tulis harus melalui pemeriksaan role.
* Operasi penghapusan akan menggunakan preview dan confirmation token.

## Role Model

Leafy AI memiliki tiga role:

* `user`
* `admin`
* `superadmin`

Setiap skill memiliki daftar role yang diperbolehkan. Jika role pengguna tidak terdaftar, skill ditolak sebelum dijalankan.

## Implemented Skills

### System

* `service_status`

Memeriksa apakah Python skill service berjalan.

### Database Inspection

* `list_tables`
* `describe_table`
* `read_table`
* `count_rows`

Skill hanya dapat mengakses database dan tabel yang telah didaftarkan.

### Client Management

* `list_clients`
* `get_client`

`list_clients` mendukung:

* Pencarian nama, kode klien, dan jenis usaha.
* Filter status.
* Filter kota.
* Pagination dengan limit dan offset.
* Batas maksimal 100 data per permintaan.

`get_client` mengambil detail satu klien berdasarkan ID.

## Database Registry

Alias database yang tersedia:

```text
leafy_core
```

Tabel yang telah terdaftar:

* `clients`
* `outreach_logs`
* `knowledge_documents`
* `knowledge_chunks`
* `pending_actions`

Tabel internal lain yang berada pada database fisik tidak otomatis dapat dilihat oleh Leafy AI.

## Client Data Model

Data klien memiliki field:

* Client code
* Name
* Business type
* Phone
* Email
* City
* Source
* Status
* Notes
* Created timestamp
* Updated timestamp

`client_code` memiliki unique constraint untuk mencegah kode klien ganda.

## Completed Integration

Alur berikut telah berhasil dijalankan:

```text
WhatsApp
→ Node.js
→ Groq Planner
→ Permission validation
→ FastAPI
→ MySQL
→ Groq Formatter
→ WhatsApp
```

Leafy AI berhasil:

* Terhubung ke WhatsApp melalui Baileys.
* Menyimpan sesi autentikasi.
* Membaca identitas PN JID dan LID.
* Memetakan pengguna superadmin.
* Menerima pesan pribadi.
* Menampilkan typing indicator.
* Memproses perintah melalui Groq.
* Memanggil FastAPI.
* Membaca database lokal.
* Mengembalikan respons natural ke WhatsApp.
* Menampilkan daftar klien.
* Menampilkan detail klien berdasarkan ID.

## Verified Test Results

### FastAPI Authentication

* Internal key valid: PASS
* Tanpa internal key: PASS — ditolak
* Internal key salah: PASS — ditolak
* Unknown skill: PASS — ditolak
* Parameter tidak sesuai schema: PASS — ditolak

### Database Security

* Database alias valid: PASS
* Database tidak terdaftar: PASS — ditolak
* Role tidak berwenang: PASS — ditolak
* Raw query: PASS — ditolak
* SQL injection pada table ID: PASS — ditolak
* Unknown table: PASS — ditolak
* Excessive limit: PASS — ditolak
* Table allowlist: PASS
* Prompt injection: PASS — tidak menjalankan SQL
* Tabel internal Laravel tidak ditampilkan: PASS

### Client Skills

* Seed data idempotent: PASS
* `list_clients`: PASS
* `get_client` dengan ID valid: PASS
* `get_client` dengan ID tidak ditemukan: PASS
* Jumlah seed client: 3

### WhatsApp

* Baileys connection: PASS
* QR authentication: PASS
* Private message: PASS
* `!ping`: PASS
* Typing indicator: PASS
* `service_status`: PASS
* `list_tables`: PASS
* `list_clients`: PASS
* `get_client`: PASS
* Group message reception: PASS
* Group `!ping`: PASS

## Seed Test Result

Detail klien pengujian berhasil diambil melalui WhatsApp:

```text
ID: 1
Client Code: TEST-CLIENT-001
Name: Demo Rental Makassar
Business Type: rental_car
City: Makassar
Source: local_seed
Status: lead
```

Data menggunakan identitas non-sensitif dan domain email `.invalid`.

## Important Engineering Decisions

### LLM Does Not Execute SQL

LLM hanya berfungsi sebagai planner dan formatter. Keputusan ini mengurangi risiko prompt injection dan query berbahaya.

### Database Credentials Are Isolated

Credential MySQL hanya disimpan pada environment Python skill service. Node.js dan Groq tidak menerima credential database.

### Default Deny

Skill, database, tabel, role, dan parameter harus terdaftar sebelum dapat digunakan.

### Safe Error Responses

Pengguna hanya menerima error yang aman dan generik. Stack trace, credential, SQL, dan detail internal tidak dikirim ke WhatsApp.

### Local Development First

Project belum masuk tahap deployment. Seluruh fitur utama, security test, write confirmation, automated test, serta endurance test harus selesai sebelum release.

## Known Issue

Deteksi mention pada grup WhatsApp belum bekerja konsisten.

Koneksi grup dan command `!ping` telah berhasil, sehingga masalah diperkirakan berada pada pencocokan identitas PN JID dan LID dalam group policy.

Masalah ini tidak menghambat pengembangan skill utama dan akan diperbaiki setelah fitur inti selesai.

## Current Development Status

Fitur baca data klien telah selesai dan lulus pengujian.

Fitur berikutnya:

1. `create_client`
2. `update_client`
3. `update_client_status`
4. Pending action dan confirmation token
5. `delete_client`
6. `find_followups`
7. `record_outreach`
8. Document parser dan OCR
9. Knowledge management
10. Rate limiting
11. Automated security tests
12. Restart dan endurance tests
13. Secret audit
14. Release gate

## Planned Write Protection

Operasi tulis akan menggunakan:

* Role validation.
* Strict parameter schema.
* Database transaction.
* Automatic commit and rollback.
* Unique constraint handling.
* Safe public error mapping.

Operasi berisiko seperti delete akan membutuhkan:

1. Preview perubahan.
2. Pending action.
3. Confirmation token.
4. Token expiration.
5. Final role verification.
6. Execution and audit record.

## Project Value

Leafy AI bukan sekadar chatbot WhatsApp. Project ini menggabungkan:

* Natural-language interface.
* Backend authorization.
* Secure skill execution.
* Database abstraction.
* Structured business workflows.
* AI planning and formatting.
* Operational automation.

Arsitekturnya memungkinkan skill baru ditambahkan tanpa memberikan akses database bebas kepada LLM.

## Development Status

```text
Stage: Local development
Branch: refactor/leafy-ai-core
Read operations: Working
WhatsApp private flow: Working
WhatsApp group reception: Working
Write operations: In development
Delete confirmation: Not implemented
Release status: Not ready
```

## Developer

**Muhpri Ridho**

Informatics graduate and full-stack developer focused on:

* React and Node.js development
* Python backend development
* Database systems
* Workflow automation
* AI and LLM integration
* WhatsApp-based business tools

