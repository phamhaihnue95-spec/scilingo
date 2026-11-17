import type { Discipline } from "../../api/types";

const DISCIPLINE_META: Record<
  Discipline,
  { label: string; badgeClass: string; dotClass: string }
> = {
  general_lab: {
    label: "Phòng thí nghiệm",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    dotClass: "bg-slate-500",
  },
  chemistry: {
    label: "Hóa học (IUPAC)",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500",
  },
  physics: {
    label: "Vật lí (SI)",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
    dotClass: "bg-sky-500",
  },
  biology: {
    label: "Sinh học",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
};

export function getDisciplineLabel(discipline: Discipline): string {
  return DISCIPLINE_META[discipline]?.label ?? discipline;
}

export function DisciplineBadge({ discipline }: { discipline: Discipline }) {
  const meta = DISCIPLINE_META[discipline] ?? DISCIPLINE_META.general_lab;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
      {meta.label}
    </span>
  );
}
