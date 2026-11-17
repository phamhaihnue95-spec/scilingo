# 04. System Architecture & API Contracts (React + FastAPI + PostgreSQL)

## 1. Tổng quan Kiến trúc (Modular Monolith theo 5 Units)

Để tối ưu tốc độ thực thi **Bolts** theo AI-DLC nhưng vẫn bảo đảm ranh giới rõ ràng giữa 5 Bounded Contexts, backend sử dụng mô hình **Modular Monolith trên Python FastAPI**, giao tiếp với **PostgreSQL 16 (pgvector)** qua các schema riêng biệt, và phục vụ **React SPA** qua REST JSON APIs.

```text
+-------------------------------------------------------------------+
|                   Frontend: React + TypeScript                    |
|  - Student Portal (Glossary, SRS Flashcard, Mindmap, Quiz 10/50)  |
|  - Teacher Studio (Lesson Packs, Exam Builder, LMS, TT94 Report)  |
|  - AI Copilot Drawer (CLIL Gen, Terminology Linter, Speech Eval)  |
+---------------------------------+---------------------------------+
                                  | HTTPS / REST JSON (+ Audio Blob)
                                  v
+-------------------------------------------------------------------+
|                 Backend: Python 3.12 + FastAPI (uv)               |
|  app/modules/                                                     |
|   ├── curriculum/      (Unit 1: KNTT8 47 bai, Terms, Integration) |
|   ├── learning/        (Unit 2: SRS SM-2, Quiz, Gamification)     |
|   ├── lms/             (Unit 3: Classrooms, Exam Builder, TT94)   |
|   ├── ai_copilot/      (Unit 4: Grounded RAG, IUPAC Linter, STT)  |
|   └── identity_billing/(Unit 5: Auth JWT, Tenants, RBAC, Quotas)  |
+---------------------------------+---------------------------------+
                                  | SQLAlchemy 2.x + Alembic + pgvector
                                  v
+-------------------------------------------------------------------+
|               PostgreSQL 16 + pgvector (Docker Dev)               |
|  Schemas: curriculum | learning | lms | ai_copilot | identity     |
+-------------------------------------------------------------------+
```

---

## 2. Cấu trúc Thư mục Đề xuất cho Bolt 1+

### 2.1. Backend (`backend/`)
* `pyproject.toml`: FastAPI, Pydantic v2, SQLAlchemy 2.x (async hoặc psycopg3), Alembic, PyJWT, Passlib/Argon2, python-docx / WeasyPrint (xuất đề Word/PDF), httpx, pytest.
* `app/core/`: config (`pydantic-settings`), database session, JWT security middleware, rate limiter, tenant context guard.
* `app/modules/<unit>/`: mỗi Unit gồm `models.py`, `schemas.py`, `repository.py`, `service.py`, `router.py` — tuyệt đối không import trực tiếp ORM model của module khác (chỉ gọi qua `service.py`).
* `tests/`:
  * `tests/unit/test_terminology_linter.py` (Gate 2A: kiểm chuẩn 13 nguyên tố & IUPAC)
  * `tests/unit/test_exam_builder_tt94.py` (Gate 2A: kiểm tra tỷ lệ điểm 10% / 50%)
  * `tests/integration/` (API + RBAC + tenant isolation tests cho Gate 2B)

### 2.2. Frontend (`frontend/`)
* `Vite + React 18+ + TypeScript + Tailwind CSS`
* `src/features/`:
  * `curriculum/`: Cây 47 bài học KNTT 8, bộ lọc 4 mạch kiến thức, bảng thẻ thuật ngữ & kết nối liên phân môn.
  * `learning/`: Trình học Flashcard SRS, Mindmap tương tác (chuyển nhanh Việt ↔ Song ngữ ↔ Anh), máy ghi âm luyện phát âm, giao diện thi thử 10%/50%.
  * `teacher/`: Kho giáo án/slide, trình tạo đề Exam Builder (hiển thị thanh đo tỷ trọng điểm tiếng Anh theo Thông tư 94), bảng theo dõi lớp học & báo cáo Mức độ 1–2–3.
  * `copilot/`: Bảng kiểm chuẩn thuật ngữ trực tiếp (highlight từ sai chuẩn IUPAC/SI như trình kiểm lỗi chính tả), trợ lý sinh câu hỏi CLIL.

---

## 3. Hợp đồng API Cốt lõi (API Contracts v1)

Tất cả endpoint đều có tiền tố `/api/v1` và trả JSON theo cấu trúc chuẩn.

### 3.1. Unit 1 — `curriculum`
* `GET /api/v1/curriculum/kntt-8/chapters` — Lấy cây 8 chương + Bài mở đầu (47 bài).
* `GET /api/v1/curriculum/lessons/{lesson_no}` — Chi tiết bài học, thuật ngữ liên quan, liên kết tích hợp liên phân môn.
* `GET /api/v1/terms?q=...&discipline=...&lesson_no=...` — Tìm kiếm thuật ngữ (kết hợp exact + fuzzy + pgvector semantic search).
* `GET /api/v1/terms/{slug}` — Chi tiết thuật ngữ: IPA, audio CDN URL, định nghĩa song ngữ, quy tắc IUPAC/13 nguyên tố.

### 3.2. Unit 2 — `learning`
* `GET /api/v1/learning/srs/due?lesson_no=...` — Danh sách thẻ Flashcard cần ôn tập hôm nay của học sinh.
* `POST /api/v1/learning/srs/review` — Gửi kết quả đánh giá thẻ (`quality: 0..5`) → cập nhật `next_review_at` và XP.
* `POST /api/v1/learning/practice/start` — Khởi tạo bài luyện tập theo `lesson_no` và `mode` (`quiz_10`, `quiz_50`, `quiz_100`).
* `POST /api/v1/learning/practice/{attempt_id}/submit` — Chấm điểm, trả giải thích song ngữ & cập nhật bảng thuật ngữ hay sai.
* `GET /api/v1/learning/gamification/me` — Streak, XP, huy hiệu 4 lĩnh vực.

### 3.3. Unit 3 — `lms` (Teacher Studio & Thông tư 94/2026)
* `GET /api/v1/lms/resources?lesson_no=...&clil_mode=...` — Lấy giáo án, slide song ngữ, thẻ từ vựng cho bài học.
* `POST /api/v1/lms/exams/generate` — Sinh đề kiểm tra từ `question_bank` theo ma trận `(lesson_nos, target_en_ratio: 0.10 | 0.50, total_points: 10.0, cognitive_matrix)`.
* `GET /api/v1/lms/exams/{exam_id}/export?format=docx|pdf` — Xuất file đề thi và đáp án sẵn sàng in.
* `POST /api/v1/lms/classrooms` & `POST /api/v1/lms/classrooms/{id}/assignments` — Tạo lớp, giao bài kiểm tra/từ vựng.
* `POST /api/v1/lms/sessions/log` — Giáo viên ghi nhận tiết dạy KHTN có dùng tiếng Anh (`periods_count`, `clil_mode`, `lesson_id`).
* `GET /api/v1/lms/reports/tt94-compliance?school_year=2026-2027` — Thống kê cho Ban Giám hiệu: số lớp triển khai, số tiết tích lũy (so sánh ngưỡng 35 / 105 tiết), tỷ lệ đề kiểm tra đạt chuẩn 10%/50%.

### 3.4. Unit 4 — `ai_copilot`
* `POST /api/v1/copilot/lint-terminology` — Nhận văn bản giáo án/câu hỏi → chạy **Deterministic Linter** (`data/terminology_rules.json`) + kiểm tra ngữ cảnh LLM → trả danh sách cảnh báo (`axit` → `acid`, `ADN` → `DNA`, `sắt(III) sunfat` → `iron(III) sulfate`, sai đơn vị SI).
* `POST /api/v1/copilot/generate-clil-questions` — Grounded RAG trên nội dung bài học Unit 1 để sinh câu hỏi song ngữ/tiếng Anh kèm đáp án, tự động chạy qua Linter trước khi trả về giáo viên.
* `POST /api/v1/copilot/pronunciation/evaluate` — Nhận audio ghi âm đọc thuật ngữ của học sinh/giáo viên → trả điểm phát âm & lỗi âm vị.

### 3.5. Unit 5 — `identity_billing`
* `POST /api/v1/auth/register` & `POST /api/v1/auth/login` & `POST /api/v1/auth/refresh`
* `GET /api/v1/tenants/me/entitlements` — Kiểm tra gói B2C/B2B hiện tại và AI quota còn lại trong tháng.

---

## 4. Chiến lược AI-DLC & Kiểm soát Chi phí / Bảo mật

1. **Deterministic First, LLM Second:**
   * Với bài toán kiểm lỗi danh pháp IUPAC/13 nguyên tố và kiểm tra ma trận điểm 10%–50%, **không phó thác cho LLM** mà xử lý bằng luật xác định (Python rule engine + unit test) để đạt độ chính xác 100% và chi phí = 0.
   * LLM chỉ dùng cho việc sinh câu hỏi CLIL mới, giải thích ngữ cảnh, và hội thoại Classroom English — luôn bị khóa chặt trong **Grounded RAG** từ dữ liệu SGK KNTT 8.
2. **Bảo vệ học sinh THCS & Chống lạm dụng API:**
   * Không lưu audio thô vĩnh viễn trừ khi học sinh chọn lưu lịch sử luyện tập ngắn hạn; không gắn tên thật công khai ngoài lớp học.
   * Mọi prompt của học sinh đi qua lớp phân loại chủ đề (chỉ cho phép hỏi đáp trong phạm vi KHTN 8), có rate limit theo `user_id` và `tenant_id`.
