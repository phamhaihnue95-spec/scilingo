# SciLingo KHTN 6–9 — Nền tảng Học & Giảng dạy Tiếng Anh Khoa học tự nhiên THCS

> **Trạng thái:** **Multi-Grade KHTN 6–9 (190 bài SGK Kết nối tri thức với cuộc sống)** + **Animation & Gamification THCS** (Unit 1: Curriculum Core **4 khối lớp 6, 7, 8, 9 · 190 bài học · 555 thuật ngữ lõi** + Bản đồ Phiêu lưu SVG 4 vùng KHTN + Bộ Đề Học 16 Units / 920 thuật ngữ IPA | Unit 2: Flashcard 3D lật thật, Sound FX, Confetti, *Chớp Nhoáng Nối Cặp 60s* (16 Units + SGK Khối 6–9), *Phòng Pha Chế & Bắt Lỗi IUPAC*, *Tháp Sắp Xếp Quy Trình (16 chuỗi KHTN 6–9)*, Sổ tay Huy hiệu Hologram 3D *SciDex 16 Units*, Mindmap & Quiz | Unit 3: Teacher Studio *Trường THCS Cầu Giấy B · GV Phạm Thị Hải*, Kho giáo án/slide CLIL 4 khối, Exam Builder 10%/50% xuất `.docx`/`.pdf`, Bảng Vàng Thi Đua Lớp, Giao Thử Thách Mini-Game 5 phút & Báo cáo Thông tư 94/2026 phân rã Khối 6–9 | Unit 5: Identity & Billing RBAC).  
> **Phạm vi Chương trình:** Trọn bộ **KHTN Khối 6, 7, 8, 9 – Bộ sách Kết nối tri thức với cuộc sống** (Lớp 6: **55 bài**, Lớp 7: **43 bài**, Lớp 8: **47 bài**, Lớp 9: **45 bài** — tổng **190 bài học**).  
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
* **AI Layer:** Grounded RAG trên SGK KNTT 6–9 + Bộ kiểm chuẩn thuật ngữ xác định (Deterministic IUPAC/SI Terminology Linter gồm 20 luật & 13 nguyên tố ngoại lệ) + Audio CDN cache + Chấm phát âm

---

## 3. Cấu trúc Workspace (Inception → Multi-Grade KHTN 6–9)

```text
scilingo/
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
│   ├── khtn6_kntt_curriculum.json             # Cây chương trình 55 bài KHTN 6 KNTT + từ khóa chuẩn
│   ├── khtn7_kntt_curriculum.json             # Cây chương trình 43 bài KHTN 7 KNTT + từ khóa chuẩn
│   ├── khtn8_kntt_curriculum.json             # Cây chương trình 47 bài KHTN 8 KNTT + từ khóa chuẩn
│   ├── khtn9_kntt_curriculum.json             # Cây chương trình 45 bài KHTN 9 KNTT + từ khóa chuẩn
│   ├── english_for_science_16_units.json      # Bộ Đề Học 16 Units (920 thuật ngữ IPA THCS)
│   └── terminology_rules.json                 # 20 luật kiểm chuẩn IUPAC (hữu cơ/vô cơ) · SI · DNA/RNA
└── scripts/
    └── validate_inception.py                  # Script kiểm tra tự động Gate 1 cho 4 khối (190 bài)
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
Truy cập `http://localhost:5173`. Các tài khoản demo (`an.hs8@demo.scilingo.vn`, `hai.gv@demo.scilingo.vn` — Cô Phạm Thị Hải, `hung.bgh@demo.scilingo.vn` — Trường THCS Cầu Giấy B) có nút đăng nhập nhanh tại mục **Đăng nhập**.

---

## 5. Hướng dẫn Deploy Production (Render + GitHub Pages)

### 5.1. Deploy Backend FastAPI + PostgreSQL lên Render (qua `render.yaml`)
1. Đăng nhập https://dashboard.render.com → chọn **New +** → **Blueprint**.
2. Kết nối GitHub repository `phamhaihnue95-spec/scilingo`.
3. Render tự đọc tệp `render.yaml` ở thư mục gốc và khởi tạo đồng thời:
   * Database PostgreSQL miễn phí (`scilingo-khtn-db`).
   * Web Service Docker (`scilingo-khtn-api`) build từ `backend/Dockerfile`, tự động chạy `alembic upgrade head` và `python -m app.seed` khi container khởi động.
4. Sau khi deploy xong, sao chép URL backend do Render cấp (ví dụ: `https://scilingo-khtn-api.onrender.com`) và kiểm tra endpoint `/api/v1/health`.

### 5.2. Deploy Frontend React lên GitHub Pages
1. Trên GitHub repository **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions**.
2. Vào **Settings → Secrets and variables → Actions → tab Variables → New repository variable**:
   * Name: `VITE_API_BASE_URL`
   * Value: URL Render Backend ở bước 5.1 (ví dụ `https://scilingo-khtn-api.onrender.com`, **không** có dấu `/` ở cuối).
3. Vào tab **Actions → Deploy Frontend to GitHub Pages → Run workflow** (hoặc push vào `main` ở thư mục `frontend/`) → website sẽ hoạt động tại `https://phamhaihnue95-spec.github.io/scilingo/`.
