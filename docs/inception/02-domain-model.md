# 02. Domain-Driven Design (DDD) & PostgreSQL Schema Blueprint

Tài liệu này định nghĩa **Ngôn ngữ chung (Ubiquitous Language)**, ranh giới **5 Units of Work (Bounded Contexts)** và thiết kế lược đồ dữ liệu **PostgreSQL 16 + pgvector** cho giai đoạn Bolt 1+.

---

## 1. Ubiquitous Language (Thuật ngữ miền nghiệp vụ)

* **Curriculum Tree (Cây chương trình):** Hệ thống phân cấp `TextbookSeries (KNTT) → Grade (8) → Chapter (0..8) → Lesson (1..47)`.
* **Discipline (Phân môn / Mạch kiến thức):** Thuộc tính của bài học trong KHTN tích hợp: `general_lab`, `chemistry`, `physics`, `biology`.
* **Term (Thuật ngữ chuẩn):** Đơn vị tri thức song ngữ gắn với ít nhất 1 `Lesson`, có trạng thái kiểm duyệt sư phạm (`verified` / `draft`).
* **IUPAC Rule / Linter Finding:** Quy tắc kiểm chuẩn danh pháp (Hóa học IUPAC, 13 nguyên tố ngoại lệ, SI, Sinh học) dùng để chấm tính hợp lệ của văn bản/đề thi.
* **CLIL Mode (Chế độ giảng dạy):** Mức độ sử dụng tiếng Anh trong tiết học hoặc bài kiểm tra: `term_only` (lồng ghép thuật ngữ), `bilingual_10` (≥ 10% nội dung/điểm), `bilingual_50` (≥ 50% nội dung/điểm), `full_english` (100%).
* **Bolt Log / Teaching Session Log:** Bản ghi tiết học KHTN thực tế giáo viên đã dạy có sử dụng tiếng Anh, là đầu vào tính chỉ số tuân thủ **Thông tư 94/2026/TT-BGDĐT** của trường.

---

## 2. Năm Bounded Contexts (5 Units of Work)

| Unit | Bounded Context | Tách biệt dữ liệu & API |
| :--- | :--- | :--- |
| **Unit 1** | `curriculum` | Sở hữu danh mục SGK KNTT 8 (47 bài), bộ từ điển thuật ngữ chuẩn, đồ thị khái niệm liên phân môn, vector embedding của SGK/thuật ngữ |
| **Unit 2** | `learning` | Sở hữu trạng thái học tập của học sinh: lịch ôn SRS, tiến độ bài học, lượt luyện phát âm, bài làm thử & điểm gamification |
| **Unit 3** | `lms` | Sở hữu lớp học, học liệu của giáo viên (slide/giáo án), ngân hàng câu hỏi & ma trận đề 10%–50%, giao bài, nhật ký tiết dạy & báo cáo Thông tư 94/2026 |
| **Unit 4** | `ai_copilot` | Sở hữu dịch vụ RAG, sinh câu hỏi CLIL, Terminology Linter, đánh giá phát âm STT và log sử dụng token |
| **Unit 5** | `identity_billing` | Sở hữu tài khoản, tổ chức/trường học (Tenant), phân quyền RBAC, gói dịch vụ B2B/B2C và quota AI |

---

## 3. Thiết kế Lược đồ PostgreSQL (Logical ER Blueprint)

Sử dụng các PostgreSQL schema tách biệt tương ứng từng Unit (`curriculum`, `learning`, `lms`, `ai_copilot`, `identity_billing`) trong cùng một database `scilingo_khtn8` (Modular Monolith trong FastAPI để tối ưu tốc độ phát triển ở các Bolt đầu, sẵn sàng tách microservice khi mở rộng).

### 3.1. Schema `identity_billing` (Unit 5)
* `tenants (id, name, tenant_type [b2c_individual|school], province, district, target_tt94_level [1|2|3], created_at)`
* `users (id, tenant_id, email, password_hash, full_name, role [student|teacher|school_admin|platform_admin], grade_level, is_active, created_at)`
* `subscriptions (id, tenant_id, plan_code [free|student_pro|teacher_pro|school_l1|school_l2], ai_monthly_quota, valid_from, valid_to, status)`

### 3.2. Schema `curriculum` (Unit 1 — Core Source of Truth)
* `chapters (id, grade, textbook_series, chapter_no, title_vi, title_en, discipline, description_vi)`
* `lessons (id, chapter_id, lesson_no, title_vi, title_en, discipline, is_practical, integration_links_json, summary_vi, summary_en)`
* `terms (id, slug, term_en, term_vi, ipa, audio_url, discipline, part_of_speech, definition_vi, definition_en, example_en, example_vi, formula_or_symbol, iupac_note, is_13_exception_element, status, embedding vector(1536))`
* `lesson_terms (lesson_id, term_id, is_core, display_order)`
* `concept_relations (id, source_term_id, target_term_id, relation_type [prerequisite|related|cross_discipline], note_vi)`

### 3.3. Schema `learning` (Unit 2 — Student Experience)
* `srs_cards (id, student_id, term_id, ease_factor, interval_days, repetitions, next_review_at, last_quality, updated_at)`
* `pronunciation_attempts (id, student_id, term_id, score, phoneme_feedback_json, audio_duration_ms, created_at)`
* `student_practice_attempts (id, student_id, lesson_id, mode [flashcard|quiz_10|quiz_50|quiz_100], score, total_questions, english_ratio, answers_json, completed_at)`
* `student_gamification (student_id, current_streak, longest_streak, total_xp, badges_json, last_study_date)`

### 3.4. Schema `lms` (Unit 3 — Teacher Studio, Exam Builder & TT94 Compliance)
* `classrooms (id, tenant_id, teacher_id, name, grade, academic_year, join_code, is_tt94_pilot_class, created_at)`
* `classroom_members (classroom_id, student_id, joined_at)`
* `teacher_resources (id, lesson_id, title, resource_type [lesson_plan|bilingual_slide|worksheet|glossary_card], clil_mode, file_url, metadata_json, is_official)`
* `question_bank (id, lesson_id, author_id, tenant_id, question_type [mcq|matching|fill_blank|short_answer], language [vi|en|bilingual], cognitive_level [know|understand|apply], prompt_text, options_json, correct_answer, explanation_vi, linked_term_ids_json, linter_verified)`
* `exams (id, teacher_id, classroom_id, title, target_en_ratio [0.10|0.50|custom], total_points, duration_minutes, matrix_json, created_at)`
* `exam_questions (exam_id, question_id, order_no, points)`
* `assignments (id, classroom_id, exam_id, title, due_at, created_at)`
* `student_submissions (id, assignment_id, student_id, score, vi_score, en_score, answers_json, submitted_at)`
* `teaching_session_logs (id, classroom_id, teacher_id, lesson_id, taught_date, periods_count, clil_mode, english_minutes, notes, created_at)`

### 3.5. Schema `ai_copilot` (Unit 4 — Guardrails & Telemetry)
* `copilot_logs (id, user_id, tenant_id, feature [clil_gen|terminology_linter|pronunciation|classroom_english], input_tokens, output_tokens, model_name, latency_ms, linter_passed, teacher_edited, created_at)`

---

## 4. Sự kiện Miền chính (Domain Events)

1. `TermReviewed` / `LessonPublished` (Unit 1) → cập nhật `embedding` cho RAG (Unit 4).
2. `QuizAttemptCompleted` (Unit 2) → cập nhật XP/Streak & thống kê từ vựng yếu cho LMS (Unit 3).
3. `ExamCreated` (Unit 3) → kích hoạt **Terminology Linter** (Unit 4) kiểm chuẩn danh pháp và xác nhận đạt mốc `10%` hoặc `50%` điểm tiếng Anh theo Thông tư 94/2026.
4. `TeachingSessionLogged` (Unit 3) → tự động cộng dồn số tiết KHTN bằng tiếng Anh cho lớp học để cập nhật **Báo cáo Mức độ 1–2–3 Thông tư 94/2026**.
