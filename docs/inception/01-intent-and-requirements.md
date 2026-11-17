# 01. Business Intent & Requirements Specification (Mob Elaboration)

**Phiên bản:** 1.0 (Bolt 0 – Inception)  
**Phạm vi Pilot MVP:** Toàn bộ **KHTN Lớp 8 – Bộ sách Kết nối tri thức với cuộc sống** (Bài 1 đến Bài 47, 8 Chương).  
**Mô hình kinh doanh:** EdTech **B2B / B2C** phục vụ học sinh, giáo viên và nhà trường THCS trên toàn quốc.

---

## 1. Business Intent (Ý định nghiệp vụ)

Xây dựng nền tảng web **học và giảng dạy Tiếng Anh Khoa học tự nhiên (KHTN) THCS** giúp:
1. **Học sinh lớp 8** làm chủ thuật ngữ, khái niệm và câu hỏi KHTN song ngữ Anh–Việt bám sát từng bài học SGK thống nhất *Kết nối tri thức với cuộc sống* (Quyết định 3588/QĐ-BGDĐT).
2. **Giáo viên KHTN** có sẵn kho giáo án/slide song ngữ theo mô hình **CLIL**, công cụ tạo đề kiểm tra định kỳ đạt tỷ lệ **10%–50%** nội dung tiếng Anh (Thông tư 94/2026/TT-BGDĐT), trợ lý AI chuẩn hóa thuật ngữ **IUPAC/SI** và lộ trình tự nâng năng lực ngoại ngữ hướng tới **Bậc 4/6** (Nghị định 222/2025/NĐ-CP).
3. **Ban Giám hiệu trường THCS** có hệ thống quản lý lớp học (LMS) và bảng thống kê minh chứng triển khai Đề án 2371/QĐ-TTg theo Phụ lục II Thông tư 94/2026/TT-BGDĐT (Mức độ 1–2–3).

---

## 2. Chân dung Người dùng (Personas)

| Persona | Mục tiêu chính | Điểm đau hiện tại (Pain Points) |
| :--- | :--- | :--- |
| **An (Học sinh lớp 8)** | Hiểu nghĩa, cách đọc và dùng đúng thuật ngữ tiếng Anh trong giờ KHTN và bài kiểm tra 10%–50% tiếng Anh | Nhầm lẫn danh pháp Hóa học IUPAC mới (`Acid`, `Base`, `Oxide`, `Iron(III) sulfate`) với tên gọi tiếng Việt cũ; không biết phát âm từ khoa học dài (*Archimedes, photosynthesis, homeostatic*); ngại làm câu hỏi thi tiếng Anh |
| **Cô Minh (Giáo viên KHTN dạy Hóa/Lí/Sinh lớp 8)** | Dạy lồng ghép/song ngữ KHTN đúng tính tích hợp, ra đề kiểm tra có 10% hoặc 50% tiếng Anh nhanh chóng | Tốn thời gian dịch/soạn slide song ngữ; sợ phát âm sai hoặc viết sai chuẩn IUPAC/SI; chưa đạt chứng chỉ Bậc 4/6; thiếu ngân hàng câu hỏi CLIL bám sát từng bài SGK KNTT |
| **Thầy Hùng (Hiệu phó chuyên môn THCS)** | Đưa trường đạt Mức độ 1 (≥ 04 lớp, ≥ 35 tiết/năm) tiến tới Mức độ 2 (≥ 50% lớp, ≥ 105 tiết/năm) theo Thông tư 94/2026 | Khó tổng hợp số tiết KHTN có dùng tiếng Anh, tỷ lệ bài kiểm tra 10%–50% của các lớp để tự đánh giá; thiếu học liệu số chuẩn hóa cho tổ KHTN |

---

## 3. Yêu cầu Chức năng (Functional Requirements & Acceptance Criteria)

### Epic A: Học liệu & Từ điển Thuật ngữ KHTN 8 (Unit 1)
* **FR-A1 (Cây chương trình KNTT 8):** Hiển thị đầy đủ **Bài 1 + 8 Chương (Bài 2–47)** bám sát 100% mục lục SGK *Kết nối tri thức với cuộc sống*.
* **FR-A2 (Thẻ thuật ngữ chuẩn hóa):** Mỗi thuật ngữ có: `term_en`, `term_vi`, `ipa`, `audio_url`, `discipline` (`chemistry` / `physics` / `biology` / `general_lab`), `definition_vi`, `definition_en`, `example_sentence_en/vi`, `formula_or_symbol`, `iupac_note` (nếu có).
* **FR-A3 (Liên kết tích hợp liên mạch):** Mỗi bài học hiển thị thẻ *"Kết nối liên phân môn"* (ví dụ Bài 8 `Acid` nối với Bài 32 `Tiêu hóa ở người` qua acid dạ dày HCl) để bảo đảm tính tích hợp KHTN theo Công văn 5208/BGDĐT-GDPT.

### Epic B: Trải nghiệm Học tập Học sinh (Unit 2)
* **FR-B1 (Flashcard SRS):** Thuật toán lặp lại ngắt quãng (SM-2 cải tiến) lên lịch ôn tập tự động theo mức độ nhớ (`Again / Hard / Good / Easy`).
* **FR-B2 (Mindmap khái niệm song ngữ):** Sơ đồ tư duy tương tác theo từng bài/chương, có nút chuyển nhanh 3 chế độ hiển thị: `Việt` ↔ `Song ngữ (Việt + Anh)` ↔ `Tiếng Anh`.
* **FR-B3 (Luyện phát âm AI):** Học sinh ghi âm đọc thuật ngữ → hệ thống trả về điểm khớp phát âm + gợi ý sửa âm tiết (tối ưu cho từ gốc Hy Lạp/Latinh).
* **FR-B4 (Luyện đề thích ứng 10% → 50%):** Chế độ luyện tập từ vựng (kéo thả, điền từ, nghe chọn) và thi thử theo nấc tỷ lệ câu tiếng Anh `10%`, `50%`, `100%`.
* **FR-B5 (Gamification):** Streak học mỗi ngày, XP, huy hiệu theo 4 mạch kiến thức và bảng xếp hạng lớp học.

### Epic C: Teacher Studio, LMS & Báo cáo Thông tư 94 (Unit 3)
* **FR-C1 (Kho giáo án & Slide CLIL):** Giáo viên tải hoặc trình chiếu trực tiếp gói học liệu theo từng bài KHTN 8 (kịch bản 5–10 phút thuật ngữ hoặc kịch bản cả tiết song ngữ).
* **FR-C2 (Exam Builder chuẩn Thông tư 94/2026):** Tạo đề kiểm tra định kỳ theo ma trận: chọn phạm vi bài học (Bài 1–47) + chọn mức độ nhận thức + chọn **tỷ lệ điểm câu hỏi tiếng Anh** (`10%` = 1.0 điểm, `50%` = 5.0 điểm, hoặc tùy chỉnh) → xuất đề `.docx`/`.pdf` kèm đáp án hoặc giao online.
* **FR-C3 (LMS Lớp học):** Giáo viên tạo lớp, mời học sinh bằng mã lớp, giao bài tập từ vựng/kiểm tra, xem thống kê học sinh yếu thuật ngữ nào.
* **FR-C4 (Nhật ký giảng dạy & Báo cáo Thông tư 94/2026):** Giáo viên ghi nhận tiết dạy KHTN có dùng tiếng Anh (`term_only` / `bilingual` / `full_english`); Ban Giám hiệu xem tổng số tiết tích lũy (so với ngưỡng 35 tiết và 105 tiết/năm học) và tỷ lệ đề kiểm tra đạt chuẩn 10%–50% của cấp THCS.

### Epic D: AI Pedagogical Copilot & Terminology Guardrails (Unit 4)
* **FR-D1 (Soạn câu hỏi/hoạt động CLIL):** Giáo viên nhập nội dung hoặc chọn bài học KHTN 8 → AI sinh câu hỏi trắc nghiệm/thảo luận song ngữ bám sát đúng thuật ngữ Unit 1 (Grounded RAG).
* **FR-D2 (Terminology Linter):** Giáo viên dán đoạn giáo án hoặc đề thi → AI + Bộ quy tắc xác định tự động quét và đề xuất sửa lỗi danh pháp (`axit sunfuric` → `sulfuric acid`, `ADN` → `DNA`, đơn vị sai chuẩn SI, nhầm quy tắc 13 nguyên tố).
* **FR-D3 (Luyện Classroom English Bậc 4/6):** Thư viện tình huống điều hành lớp học KHTN (an toàn phòng thí nghiệm Bài 1, hướng dẫn đo cường độ dòng điện Bài 24, giải thích cân bằng tự nhiên Bài 46) kèm AI đóng vai hội thoại.

### Epic E: Quản trị B2B/B2C & Phân quyền (Unit 5)
* **FR-E1 (Multi-tenant):** Phân biệt người dùng B2C độc lập và tổ chức B2B (Trường THCS với Tổ KHTN, Lớp học).
* **FR-E2 (RBAC):** 4 vai trò rõ ràng: `student`, `teacher`, `school_admin`, `platform_admin`.
* **FR-E3 (Quota & Entitlement):** Giới hạn tính năng nâng cao và lượt gọi AI theo gói Freemium / Pro / School License.

---

## 4. Yêu cầu Phi chức năng (Non-Functional Requirements)

* **Hiệu năng:** Thời gian phản hồi API tra cứu thuật ngữ & flashcard `< 200ms` (p95); audio phát âm phục vụ qua CDN/static cache.
* **Độ chính xác sư phạm (Zero-Hallucination on Core Terms):** 100% nội dung AI sinh ra trong đề thi và thẻ bài học phải được xác thực qua lớp **Terminology Guardrail** trước khi hiển thị cho học sinh.
* **Bảo mật & Quyền riêng tư trẻ em (THCS):** Không thu thập thông tin nhạy cảm thừa của học sinh dưới 16 tuổi; cô lập dữ liệu lớp học theo `tenant_id`; mã hóa mật khẩu bằng Argon2/bcrypt, xác thực JWT có refresh token.
* **Khả năng mở rộng SGK:** Kiến trúc dữ liệu hỗ trợ gắn `grade` (6, 7, 8, 9) và `textbook_series` (`kntt`) ngay từ đầu để mở rộng sang lớp 6, 7, 9 ở các pha sau mà không sửa schema lõi.
* **Kiểm soát chi phí AI:** Caching audio theo `term_id`, caching kết quả RAG theo cặp `(lesson_id, prompt_hash)`, giới hạn rate limit AI theo gói người dùng.
