import type { Discipline } from "../../api/types";

const DISCIPLINE_META: Record<
  Discipline,
  { label: string; badgeClass: string; dotClass: string }
> = {
  general_lab: {
    label: "Phòng thí nghiệm",
    badgeClass: "bg-violet-100 text-violet-800 border-violet-200",
    dotClass: "bg-violet-500",
  },
  chemistry: {
    label: "Hóa học (IUPAC)",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
    dotClass: "bg-orange-500",
  },
  physics: {
    label: "Vật lí (SI)",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-200",
    dotClass: "bg-sky-500",
  },
  biology: {
    label: "Sinh học",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
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
