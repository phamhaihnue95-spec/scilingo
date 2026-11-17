# SciLingo KHTN 8 — Nền tảng Học & Giảng dạy Tiếng Anh Khoa học tự nhiên THCS

> **Trạng thái:** **Bolt 2 hoàn tất** (Unit 1: Curriculum Core 47 bài + Unit 2: Flashcard SRS, Mindmap song ngữ, Quiz 10%/50%/100%, Gamification + Unit 5: Identity & Billing RBAC).  
> **Phạm vi Pilot MVP:** Toàn bộ chương trình **KHTN Lớp 8 – Bộ sách Kết nối tri thức với cuộc sống** (Bài 1 đến Bài 47, 8 Chương).  
> **Phương pháp phát triển:** **AI-DLC (AI-Driven Development Life Cycle)** — `Inception → Construction (Bolts) → Operations`.

---

## 1. Bối cảnh & Mục tiêu sản phẩm

Nền tảng EdTech mô hình **B2B/B2C** giúp học sinh THCS và giáo viên KHTN chuyển đổi sang dạy – học song ngữ/tiếng Anh một cách bài bản, bám sát khung pháp lý mới nhất của Việt Nam:

* **Thông tư 32/2018/TT-BGDĐT** & **Quyết định 3588/QĐ-BGDĐT (26/12/2025):** Áp dụng thống nhất toàn quốc bộ SGK *Kết nối tri thức với cuộc sống* từ năm học 2026–2027; tuân thủ danh pháp Hóa học **IUPAC**, hệ đơn vị **SI** và thuật ngữ quốc tế (`DNA`, `RNA`).
* **Quyết định 2371/QĐ-TTg (27/10/2025)** & **Thông tư 94/2026/TT-BGDĐT (03/11/2026, hiệu lực 19/12/2026):** Đề án *Đưa tiếng Anh thành ngôn ngữ thứ hai trong trường học*; hỗ trợ nhà trường phổ thông đáp ứng tiêu chí Mức độ 1–2–3 (tối thiểu 35 đến 105 tiết/năm học, thiết kế **10%–50%** nội dung bài kiểm tra định kỳ bằng tiếng Anh).
* **Nghị định 222/2025/NĐ-CP (08/08/2025):** Ưu tiên dạy và học KHTN bằng tiếng nước ngoài; hỗ trợ giáo viên THCS nâng chuẩn năng lực ngoại ngữ hướng tới **Bậc 4/6**.
* **Công văn 5208/BGDĐT-GDPT (07/08/2026):** Giữ vững bản chất **tích hợp** của môn KHTN, không chia cắt cơ học thành các phân môn rời rạc.

---

## 2. Ngăn xếp công nghệ (Tech Stack)

* **Frontend:** React + TypeScript + Vite + Tailwind CSS
* **Backend API:** Python 3.12 + FastAPI (`uv` quản lý môi trường & dependencies)
* **Database:** PostgreSQL 16 + `pgvector` (qua Docker Compose cho môi trường dev)
* **AI Layer:** Grounded RAG trên SGK KNTT 8 + Bộ kiểm chuẩn thuật ngữ xác định (Deterministic IUPAC/SI Terminology Linter) + Audio CDN cache + Chấm phát âm

---

## 3. Cấu trúc Workspace (Bolt 0 – Inception)

```text
KHTN/
├── README.md                                  # Tổng quan dự án & hướng dẫn chạy
├── AGENTS.md                                  # Hiến chương AI-DLC cho các Agent ở các Bolt sau
├── docker-compose.yml                         # PostgreSQL 16 + pgvector cho môi trường dev
├── .env.example                               # Biến môi trường mẫu
├── docs/
│   └── inception/
│       ├── 01-intent-and-requirements.md      # Business Intent, Personas, User Stories, NFRs
│       ├── 02-domain-model.md                 # DDD Bounded Contexts (5 Units) & PostgreSQL Schema
│       ├── 03-pedagogical-guardrails.md       # Quy chuẩn IUPAC, 13 nguyên tố, SI, đề thi 10%-50%
│       ├── 04-architecture-and-api.md         # Kiến trúc React + FastAPI + PostgreSQL & API Contracts
│       └── 05-units-and-bolt-plan.md          # Lộ trình Bolt 0 -> Bolt 4 & Validation Gates
├── data/
│   ├── khtn8_kntt_curriculum.json             # Cây chương trình đầy đủ 47 bài KHTN 8 KNTT + từ khóa mẫu
│   └── terminology_rules.json                 # Luật kiểm chuẩn danh pháp IUPAC / SI / Sinh học
└── scripts/
    └── validate_inception.py                  # Script kiểm tra tự động Gate 1 cho dữ liệu & tài liệu
```

---

## 4. Hướng dẫn chạy & kiểm thử (Bolt 1)

### 4.1. Kiểm thử tự động (Backend + Gate 1 + Frontend Build)
```powershell
py scripts/validate_inception.py
cd backend; uv run pytest -v; uv run ruff check app tests
cd ..\frontend; npm run build
```

### 4.2. Chạy Backend FastAPI (PostgreSQL Docker hoặc SQLite local)
* **Với PostgreSQL 16 (Docker Desktop):**
```powershell
copy .env.example .env
docker compose up -d
cd backend
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload
```
* **Chạy thử nhanh không cần Docker (SQLite local fallback):**
```powershell
cd backend
$env:DATABASE_URL="sqlite:///./scilingo_dev.db"
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload
```

### 4.3. Chạy Frontend React (Vite)
```powershell
cd frontend
npm run dev
```
Truy cập `http://localhost:5173`. Các tài khoản demo (`an.hs8@demo.scilingo.vn`, `minh.gv@demo.scilingo.vn`, `hung.bgh@demo.scilingo.vn`) có nút đăng nhập nhanh tại mục **Đăng nhập**.
