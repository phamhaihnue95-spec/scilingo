# 03. Quy chuẩn Sư phạm & Bộ Kiểm chuẩn Thuật ngữ (Gate 1 Spec)

Tài liệu này là bộ tiêu chuẩn bắt buộc để kiểm duyệt học liệu KHTN Lớp 8 (Bộ *Kết nối tri thức với cuộc sống*) và làm luật kiểm tra cho **Deterministic Terminology Linter (Unit 4)** nhằm chống AI bịa/dịch sai thuật ngữ.

---

## 1. Quy tắc Danh pháp Hóa học IUPAC (Chương I & II + Bài 1)

Căn cứ Chương trình GDPT 2018 môn Khoa học tự nhiên (**Thông tư 32/2018/TT-BGDĐT**, tham chiếu TCVN 5529:2010 và TCVN 5530:2010):

### 1.1. Bắt buộc chuẩn tiếng Anh IUPAC
* **Tên loại hợp chất & khái niệm:** Dùng `Acid` (không viết `Axit`), `Base` (không viết `Bazơ`), `Oxide` (không viết `Oxit`), `pH`, `Mol` (`Mole`), `Catalyst`, `Concentration`.
* **Tên nguyên tố phổ biến ngoài danh sách ngoại lệ:** `Hydrogen`, `Oxygen`, `Carbon`, `Chlorine`, `Magnesium`, `Calcium`, `Phosphorus`, `Silicon`... (không dùng `Hiđro`, `Oxi`, `Clo`, `Magiê`, `Canxi`).
* **Toàn bộ hợp chất hóa học:** Bắt buộc gọi tên theo danh pháp IUPAC tiếng Anh trong cả bài giảng và đề kiểm tra:
  * *Acid:* `Hydrochloric acid` (`HCl`), `Sulfuric acid` (`H₂SO₄`), `Nitric acid` (`HNO₃`), `Acetic acid` (`CH₃COOH`).
  * *Base:* `Sodium hydroxide` (`NaOH`), `Calcium hydroxide` (`Ca(OH)₂`), `Copper(II) hydroxide` (`Cu(OH)₂`).
  * *Oxide:* `Carbon dioxide` (`CO₂`), `Calcium oxide` (`CaO`), `Iron(III) oxide` (`Fe₂O₃`), `Copper(II) oxide` (`CuO`).
  * *Muối (Salt):* `Sodium chloride` (`NaCl`), `Calcium carbonate` (`CaCO₃`), `Iron(III) sulfate` (`Fe₂(SO₄)₃`), `Ammonium nitrate` (`NH₄NO₃`).

### 1.2. Ngoại lệ 13 nguyên tố giữ tên tiếng Việt ở dạng đơn chất / đời sống
Theo nguyên tắc thực tế của Chương trình GDPT 2018, 13 nguyên tố sau **được phép dùng tên tiếng Việt** khi nói về đơn chất hoặc vật thể trong đời sống (kèm chú thích tiếng Anh IUPAC trong học liệu), nhưng **khi tham gia hợp chất phải chuyển sang tên IUPAC**:

| STT | Tiếng Việt (Đơn chất/Đời sống) | IUPAC Tiếng Anh | Ký hiệu | Ví dụ hợp chất bắt buộc IUPAC |
| :---: | :--- | :--- | :---: | :--- |
| 1 | Vàng | `Gold` | Au | `Gold(III) chloride` |
| 2 | Bạc | `Silver` | Ag | `Silver nitrate` (`AgNO₃`) |
| 3 | Đồng | `Copper` | Cu | `Copper(II) sulfate` (`CuSO₄`) |
| 4 | Chì | `Lead` | Pb | `Lead(II) nitrate` |
| 5 | Sắt | `Iron` | Fe | `Iron(III) sulfate` (`Fe₂(SO₄)₃`) |
| 6 | Nhôm | `Aluminium` | Al | `Aluminium hydroxide` (`Al(OH)₃`) |
| 7 | Kẽm | `Zinc` | Zn | `Zinc chloride` (`ZnCl₂`) |
| 8 | Lưu huỳnh | `Sulfur` | S | `Sulfur dioxide` (`SO₂`), `Sulfuric acid` |
| 9 | Thiếc | `Tin` | Sn | `Tin(II) chloride` |
| 10 | Nitơ | `Nitrogen` | N | `Nitrogen dioxide`, `Nitric acid` |
| 11 | Natri | `Sodium` | Na | `Sodium chloride` (`NaCl`), `Sodium hydroxide` |
| 12 | Kali | `Potassium` | K | `Potassium hydroxide` (`KOH`), `Potassium nitrate` |
| 13 | Thủy ngân | `Mercury` | Hg | `Mercury(II) oxide` |

> **Lưu ý cho Linter:** Quy tắc này có sẵn dưới dạng JSON máy đọc tại `data/terminology_rules.json`. Linter không báo lỗi khi bài viết nói *"đinh sắt"* hoặc *"dây đồng"* ở ngữ cảnh đơn chất, nhưng **báo lỗi ngay** nếu viết *"sắt(III) sunfat"* hoặc *"natri hiđroxit"* thay vì `Iron(III) sulfate` / `Sodium hydroxide`.

---

## 2. Quy chuẩn Vật lí & Hệ đo lường Quốc tế SI (Chương III – VI)

* Giữ chuẩn ký hiệu đại lượng và đơn vị **SI** xuyên suốt KHTN 8:
  * **Chương III (Khối lượng riêng & Áp suất):** `Density` (`ρ`, `kg/m³` hoặc `g/cm³`), `Pressure` (`p`, `Pa` = `N/m²`), `Atmospheric pressure`, `Buoyant force / Upthrust` (`F_A`, `N` — Lực đẩy Archimedes).
  * **Chương IV (Tác dụng làm quay của lực):** `Moment of force / Torque` (`M`, `N·m` — SGK KNTT dùng trực tiếp từ `Moment lực`), `Pivot / Fulcrum`, `Lever`.
  * **Chương V (Điện):** `Electric charge`, `Electric current` (`I`, `A` - Ammeter), `Voltage / Potential difference` (`U` trong chương trình VN / `V` đơn vị Volt - Voltmeter), `Series / Parallel circuit`.
  * **Chương VI (Nhiệt):** `Thermal energy`, `Internal energy`, `Joulemeter` (`J` - Joule — SGK KNTT Bài 27 dùng trực tiếp `joulemeter`), `Conduction`, `Convection`, `Radiation`, `Thermal expansion`.
* **Quy ước ký hiệu toán/lí Việt Nam vs Quốc tế:** Khi hiển thị công thức song ngữ (ví dụ hiệu điện thế: SGK VN thường ký hiệu `U`, tài liệu tiếng Anh hay ký hiệu `V`), thẻ học liệu phải ghi chú rõ sự tương đương (`U` / `V`, đơn vị `V - Volt`) để học sinh không bị nhầm khi đọc tài liệu nước ngoài.

---

## 3. Quy chuẩn Sinh học (Chương VII & VIII)

* **Sinh học cơ thể người (Bài 30–40):** Chuẩn hóa cặp thuật ngữ hệ cơ quan (`Skeletal/Muscular system`, `Digestive system`, `Circulatory system`, `Respiratory system`, `Excretory system`, `Homeostasis`, `Nervous system`, `Endocrine system`, `Thermoregulation`, `Reproductive system`).
* **Di truyền & Phân tử (chuẩn GDPT 2018):** Thống nhất dùng `DNA`, `RNA` (cảnh báo nếu viết `ADN`, `ARN` trong văn bản mới).
* **Sinh thái học (Bài 41–47):** Phân biệt chính xác `Organism` (Cá thể sinh vật) → `Population` (Quần thể) → `Community` (Quần xã) → `Ecosystem` (Hệ sinh thái) → `Biosphere` (Sinh quyển), tránh dịch nhầm `Population` thành "dân số" trong ngữ cảnh sinh học!

---

## 4. Quy tắc Tích hợp KHTN (Công văn 5208/BGDĐT-GDPT)

* Không cô lập hoàn toàn Hóa – Lí – Sinh thành 3 ứng dụng tách biệt.
* Trong cấu trúc dữ liệu `Lesson`, mỗi bài học có trường `integration_links_json` liên kết các khái niệm giao thoa trong chính KHTN 8:
  * *Ví dụ:* Bài 8 (`Acid`) ↔ Bài 32 (`Dinh dưỡng và tiêu hóa ở người` – vai trò acid HCl trong dịch vị dạ dày).
  * *Ví dụ:* Bài 16 (`Áp suất chất lỏng. Áp suất khí quyển`) ↔ Bài 33 & 34 (`Máu và hệ tuần hoàn` – huyết áp; `Hệ hô hấp` – chênh lệch áp suất khi hít thở).
  * *Ví dụ:* Bài 26 & 28 (`Năng lượng nhiệt`, `Truyền nhiệt`) ↔ Bài 39 (`Da và điều hòa thân nhiệt ở người`).

---

## 5. Quy chuẩn Đề kiểm tra 10% – 50% Tiếng Anh (Thông tư 94/2026/TT-BGDĐT)

Trong **Unit 3 (Exam Builder)**:
* Mỗi đề kiểm tra có thuộc tính `total_points` (mặc định `10.0`) và `target_en_ratio`:
  * **Preset Mức khởi đầu (`10%`):** Tổng điểm các câu hỏi bằng tiếng Anh đạt **tối thiểu 1.0 / 10.0 điểm** (sai số cho phép `>= 10%` tổng điểm).
  * **Preset Mức nâng cao (`50%`):** Tổng điểm các câu hỏi bằng tiếng Anh đạt **tối thiểu 5.0 / 10.0 điểm** (sai số cho phép `>= 50%` tổng điểm).
* **Quy tắc xác định câu hỏi tiếng Anh hợp lệ:** Câu hỏi được tính vào tỷ lệ tiếng Anh phải có cả phần dẫn (`prompt_text`) và lựa chọn/yêu cầu trả lời (`options_json` / rubric) bằng tiếng Anh (có thể cho phép chú thích tối đa 1–2 từ hiếm trong ngoặc đơn ở chế độ làm quen, nhưng không tính câu hỏi 100% tiếng Việt chỉ chèn 1 từ tiếng Anh vào tỷ lệ 10%/50%).
