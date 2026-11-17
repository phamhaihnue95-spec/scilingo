# 05. Units of Work & Kế hoạch Thực thi theo Chu kỳ Bolts (AI-DLC)

## 1. Tổng quan Lộ trình AI-DLC cho Pilot KHTN 8 KNTT

| Giai đoạn | Chu kỳ | Trọng tâm | Trạng thái |
| :--- | :--- | :--- | :--- |
| **Inception** | **Bolt 0** | Mob Elaboration, Domain Design (5 Units), Quy chuẩn IUPAC/SI/TT94, Seed 47 bài SGK KNTT 8, Script kiểm chuẩn Gate 1 | **Hoàn tất (Chờ duyệt Gate 1)** |
| **Construction** | **Bolt 1** | Khởi tạo FastAPI + PostgreSQL (Docker) + React + Unit 1 (`curriculum` 47 bài & thuật ngữ đầy đủ) + Unit 5 (Auth/RBAC cơ bản) | Kế hoạch tiếp theo |
| **Construction** | **Bolt 2** | Unit 2 (`learning`: Flashcard SRS, Mindmap song ngữ, Quiz 10%/50%/100%, Gamification) | Kế hoạch tiếp theo |
| **Construction** | **Bolt 3** | Unit 3 (`lms`: Kho giáo án/slide mẫu, Exam Builder chuẩn 10%/50% xuất PDF/Word, Lớp học, Báo cáo Thông tư 94/2026) | Kế hoạch tiếp theo |
| **Construction** | **Bolt 4** | Unit 4 (`ai_copilot`: Terminology Linter, RAG sinh câu hỏi CLIL, Chấm phát âm, Telemetry & Hardening) | Kế hoạch tiếp theo |
| **Operations** | **Ongoing** | Giám sát chi phí AI/người dùng, theo dõi Edit Rate của giáo viên, cập nhật khi có văn bản mới của Bộ GD&ĐT | Sau MVP |

---

## 2. Chi tiết Deliverables & Gates từng Bolt

### Bolt 0 — Inception *(Hiện tại)*
* **Artifacts đã tạo:**
  * Bộ tài liệu Inception `docs/inception/01..05` và `AGENTS.md`.
  * Bộ dữ liệu cây chương trình chuẩn **47 bài KHTN 8 Kết nối tri thức với cuộc sống** (`data/khtn8_kntt_curriculum.json`) kèm hạt giống thuật ngữ & liên kết tích hợp liên phân môn.
  * Bộ luật máy đọc kiểm chuẩn thuật ngữ IUPAC/13 nguyên tố/SI/Sinh học (`data/terminology_rules.json`).
  * Hạ tầng dev DB (`docker-compose.yml` PostgreSQL 16 + pgvector) và script kiểm tra Gate 1 (`scripts/validate_inception.py`).
* **Gate 1 (Cần bạn rà soát & xác nhận trước Bolt 1):**
  * Xác nhận danh mục 47 bài KHTN 8 KNTT & phân bổ 4 mạch kiến thức.
  * Xác nhận ưu tiên nội dung cho Bolt 1–3 (nên dùng dữ liệu thuật ngữ/câu hỏi mẫu đầy đủ cho ít nhất 1–2 chương trọng tâm của mỗi phân môn Hóa – Lí – Sinh, hay sinh đủ thuật ngữ hạt giống cho toàn bộ 47 bài ngay trong Bolt 1).

### Bolt 1 — Foundation, Unit 1 (Curriculum Core) & Unit 5 (Auth/Tenant)
* **Thời lượng mục tiêu:** 1–2 ngày (chu kỳ AI-DLC Bolt).
* **Deliverables:**
  * Scaffold `backend/` (`uv` + FastAPI + Alembic migrations cho schemas `identity_billing` và `curriculum`).
  * Seed script nạp 47 bài học + bộ từ điển thuật ngữ KHTN 8 chuẩn hóa vào PostgreSQL.
  * Scaffold `frontend/` (React + TypeScript + Tailwind + Router) với trang duyệt **Bản đồ 47 bài KHTN 8**, tìm kiếm thuật ngữ tức thì, xem thẻ thuật ngữ (IPA, công thức, lưu ý IUPAC, liên kết liên phân môn) và đăng nhập/phân quyền cơ bản (`student`, `teacher`, `school_admin`).
* **Validation Gate:** Pytest kiểm tra toàn vẹn dữ liệu 47 bài qua API + kiểm tra RBAC isolation + Frontend build/typecheck sạch.

### Bolt 2 — Unit 2: Student Learning Engine (SRS, Mindmap, Quiz 10%/50%)
* **Thời lượng mục tiêu:** 2–3 ngày.
* **Deliverables:**
  * Thuật toán Flashcard SRS (`SM-2` variant) lưu tiến độ học sinh.
  * Interactive Bilingual Mindmap cho mỗi chương/bài (chuyển chế độ `VI / Song ngữ / EN`).
  * Chế độ luyện tập & thi thử theo nấc `10%`, `50%`, `100%` câu hỏi tiếng Anh + hệ thống Streak/XP/Huy hiệu 4 mạch.
* **Validation Gate:** Test đơn vị thuật toán SRS, test logic tính điểm & tỷ lệ câu hỏi tiếng Anh, UX test trên cả màn hình desktop & tablet/mobile.

### Bolt 3 — Unit 3: Teacher Studio, LMS, Exam Builder & TT94 Reporting
* **Thời lượng mục tiêu:** 2–3 ngày.
* **Deliverables:**
  * Kho mẫu giáo án/slide song ngữ & thẻ trình chiếu thuật ngữ theo từng bài KHTN 8.
  * **Exam Builder** tạo đề theo ma trận + thanh chọn tỷ lệ điểm tiếng Anh (`10%` = 1 điểm, `50%` = 5 điểm) + xuất Word/PDF.
  * Quản lý lớp học (mã tham gia lớp, giao bài, xem bảng điểm học sinh yếu từ nào).
  * Nhật ký tiết dạy & **Dashboard tự đánh giá Thông tư 94/2026** cho Ban Giám hiệu (theo dõi mốc 35 tiết / 105 tiết & tỷ lệ lớp).
* **Validation Gate:** **Gate 2A (Pedagogical Gate)** xác minh công thức tính tỷ trọng điểm tiếng Anh chính xác tuyệt đối; test xuất file Word/PDF không lỗi font tiếng Việt và ký hiệu hóa học/SI (`H₂SO₄`, `kg/m³`, `N·m`).

### Bolt 4 — Unit 4: AI Copilot, Terminology Linter & Operations Readiness
* **Thời lượng mục tiêu:** 2–3 ngày.
* **Deliverables:**
  * **Deterministic Terminology Linter Engine** (chạy rulebook `terminology_rules.json` + ngữ cảnh 13 nguyên tố) tích hợp trực tiếp vào Exam Builder và ô soạn thảo giáo viên.
  * **Grounded RAG CLIL Generator** sinh câu hỏi/hoạt động tiếng Anh bám sát bài học KHTN 8 (mọi output bắt buộc qua Linter).
  * API đánh giá phát âm thuật ngữ + kịch bản luyện Classroom English cho giáo viên (hướng tới Bậc 4/6).
  * Bảng **Telemetry & Cost Guard** (theo dõi token, rate limit, log edit rate của giáo viên).
* **Validation Gate:** **Gate 2A & 2B** — bộ test 30+ ca bẫy danh pháp (`axit sunfuric`, `sắt(III) sunfat`, `đinh sắt`, `ADN`, `oxi`, sai đơn vị `N/m2`...) phải đạt 100% độ chính xác phát hiện/không báo lỗi giả (`đinh sắt`); test bảo mật chống lộ dữ liệu chéo giữa các trường học.
