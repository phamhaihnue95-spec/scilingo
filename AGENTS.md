# AI-DLC Agent Charter — SciLingo KHTN 8

Tài liệu này quy định nguyên tắc bắt buộc cho mọi AI Agent và kỹ sư khi thực hiện **Construction Bolts (Bolt 1+)** trong repository này.

## 1. Quy trình làm việc theo AI-DLC
1. **Đọc Spec trước khi code:** Mọi thay đổi thuộc Unit nào phải đối chiếu đúng tài liệu trong `docs/inception/` trước khi sinh code hoặc migration.
2. **Tôn trọng ranh giới Bounded Context (5 Units):**
   - `Unit 1 (curriculum)`: Nguồn chân lý duy nhất (Single Source of Truth) cho cây bài học KHTN 8 KNTT (47 bài), từ điển thuật ngữ, quy tắc IUPAC/SI. Các Unit khác chỉ đọc qua service/interface, không tự định nghĩa lại danh pháp.
   - `Unit 2 (learning)`: Logic học tập học sinh (Flashcard SRS, Mindmap, Phát âm, Làm bài thi, Gamification).
   - `Unit 3 (lms)`: Logic giáo viên & nhà trường (Kho giáo án/slide CLIL, Exam Builder 10%/50%, Lớp học, Báo cáo minh chứng Thông tư 94/2026).
   - `Unit 4 (ai_copilot)`: RAG, sinh câu hỏi CLIL, Terminology Linter, chấm phát âm. Mọi output của LLM **bắt buộc** đi qua Terminology Linter đối chiếu `data/terminology_rules.json` và Unit 1.
   - `Unit 5 (identity_billing)`: Tenant trường học, phân quyền RBAC (`student`, `teacher`, `school_admin`, `platform_admin`), gói B2B/B2C và hạn mức AI quota.
3. **Làm việc theo Bolt & Validation Gate:**
   - Không gộp nhiều Unit lớn trong 1 thay đổi mất kiểm soát.
   - Mọi Bolt kết thúc bằng kiểm thử tự động (`pytest`, typecheck/build React) và đối chiếu **Gate 2A (Độ chính xác sư phạm)** + **Gate 2B (Bảo mật & Chi phí)**.

## 2. Ràng buộc Sư phạm Bất di bất dịch (KHTN 8 KNTT)
1. **Không chia cắt cơ học môn KHTN:** Mỗi bài học thuộc 1 trong 4 mạch/phân môn nhưng luôn duy trì liên kết tích hợp liên chủ đề (theo Công văn 5208/BGDĐT-GDPT).
2. **Quy tắc Danh pháp Hóa học IUPAC (Thông tư 32/2018/TT-BGDĐT):**
   - Dùng tên tiếng Anh chuẩn IUPAC cho các nguyên tố và **toàn bộ hợp chất** (`Acid`, `Base`, `Oxide`, `Sodium hydroxide`, `Iron(III) sulfate`, `Hydrochloric acid`...).
   - **Ngoại lệ 13 nguyên tố ở dạng đơn chất / vật thể đời sống:** *vàng, bạc, đồng, chì, sắt, nhôm, kẽm, lưu huỳnh, thiếc, nitơ, natri, kali, thủy ngân* — được dùng tiếng Việt trong ngữ cảnh đơn chất/đời sống (có chú thích tiếng Anh), nhưng ở dạng hợp chất **bắt buộc dùng IUPAC tiếng Anh**.
   - Linter phải cảnh báo nếu giáo án hoặc đề thi mới còn dùng cách viết phiên âm cũ (`axit`, `bazơ`, `oxit`, `hiđro`, `oxi`, `canxi`, `natri clorua`...) trong ngữ cảnh danh pháp hóa học.
3. **Chuẩn Sinh học & Vật lí:**
   - Ưu tiên `DNA`, `RNA` thay cho `ADN`, `ARN`.
   - Chuẩn hóa hệ đơn vị quốc tế **SI** (`kg/m³`, `Pa`, `N·m`, `A`, `V`, `J`).
4. **Quy chuẩn Đề kiểm tra Thông tư 94/2026/TT-BGDĐT:**
   - Exam Builder phải tính chính xác tỷ trọng điểm phần câu hỏi tiếng Anh (hỗ trợ preset `10%` = 1/10 điểm và `50%` = 5/10 điểm, cùng tùy chỉnh `0%` hoặc `100%`).
5. **An toàn dữ liệu học sinh THCS:**
   - Dữ liệu học sinh (lớp học, điểm số, bản ghi âm phát âm) được cô lập theo `tenant_id` / `classroom_id`.
   - AI Copilot cho học sinh không cho phép trò chuyện tự do ngoài phạm vi KHTN 8 (chống prompt injection & lạm dụng token).
