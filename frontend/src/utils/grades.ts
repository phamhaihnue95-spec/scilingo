import type { GradeLevel } from "../api/types";

export const VALID_GRADES: readonly GradeLevel[] = [6, 7, 8, 9];

export const GRADE_LESSON_COUNTS: Record<GradeLevel, number> = {
  6: 55,
  7: 43,
  8: 47,
  9: 45,
};

export const GRADE_INFO: Record<
  GradeLevel,
  { label: string; shortLabel: string; focusVi: string; gradient: string }
> = {
  6: {
    label: "Khối 6 (55 bài)",
    shortLabel: "Lớp 6",
    focusVi: "Phép đo SI · Hỗn hợp · Tế bào & Đa dạng sinh học · Lực & Năng lượng",
    gradient: "from-emerald-600 via-teal-500 to-cyan-500",
  },
  7: {
    label: "Khối 7 (43 bài)",
    shortLabel: "Lớp 7",
    focusVi: "Nguyên tử & Bảng tuần hoàn IUPAC · Tốc độ–Âm–Ánh sáng–Từ · Quang hợp",
    gradient: "from-sky-600 via-blue-500 to-indigo-500",
  },
  8: {
    label: "Khối 8 (47 bài)",
    shortLabel: "Lớp 8",
    focusVi: "Acid–Base–Oxide IUPAC · Áp suất SI · Điện · Sinh lí & Sinh thái",
    gradient: "from-indigo-600 via-sky-500 to-teal-400",
  },
  9: {
    label: "Khối 9 (45 bài)",
    shortLabel: "Lớp 9",
    focusVi: "Hóa hữu cơ IUPAC · Định luật Ohm–Thấu kính · Di truyền DNA/RNA & Tiến hóa",
    gradient: "from-fuchsia-600 via-purple-600 to-indigo-600",
  },
};

const STORAGE_KEY = "scilingo_grade";

export function normalizeGrade(value: unknown, fallback: GradeLevel = 8): GradeLevel {
  const num = Number(value);
  if (num === 6 || num === 7 || num === 8 || num === 9) return num;
  return fallback;
}

export function getSavedGrade(): GradeLevel {
  try {
    return normalizeGrade(localStorage.getItem(STORAGE_KEY), 8);
  } catch {
    return 8;
  }
}

export function saveGrade(grade: GradeLevel): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(grade));
  } catch {
    // Ignore storage quota/privacy mode errors
  }
}
