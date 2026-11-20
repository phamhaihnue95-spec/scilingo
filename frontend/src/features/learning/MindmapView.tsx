import { useEffect, useState } from "react";
import { GitBranch, Link2, Volume2 } from "lucide-react";

import { api } from "../../api/client";
import type { GradeLevel, LessonMindmap, MindmapNode } from "../../api/types";
import { GRADE_LESSON_COUNTS } from "../../utils/grades";
import { speakEnglishTerm } from "../../utils/speech";
import { DisciplineBadge } from "../curriculum/DisciplineBadge";

interface Props {
  grade?: GradeLevel;
  initialLessonNo?: number;
}

type LangMode = "bilingual" | "vi" | "en";

export function MindmapView({ grade = 8, initialLessonNo = 8 }: Props) {
  const maxLessons = GRADE_LESSON_COUNTS[grade];
  const [lessonNo, setLessonNo] = useState(() =>
    Math.min(Math.max(1, initialLessonNo), GRADE_LESSON_COUNTS[grade])
  );
  const [langMode, setLangMode] = useState<LangMode>("bilingual");
  const [mindmap, setMindmap] = useState<LessonMindmap | null>(null);
  const [selectedNode, setSelectedNode] = useState<MindmapNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLessonNo(Math.min(Math.max(1, initialLessonNo), maxLessons));
  }, [grade, initialLessonNo, maxLessons]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getLessonMindmap(lessonNo, grade)
      .then((data) => {
        if (!active) return;
        setMindmap(data);
        setSelectedNode(data.nodes[0] ?? null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lessonNo, grade]);

  const rootNode = mindmap?.nodes.find((n) => n.node_type === "lesson");
  const termNodes = mindmap?.nodes.filter((n) => n.node_type === "term") ?? [];
  const integrationNodes = mindmap?.nodes.filter((n) => n.node_type === "integration") ?? [];

  const renderPrimaryLabel = (node: MindmapNode) => {
    if (langMode === "vi") return node.label_vi;
    if (langMode === "en") return node.label_en;
    return node.label_en;
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase text-slate-500">
            Chọn bài KHTN {grade}:
          </label>
          <select
            value={lessonNo}
            onChange={(e) => setLessonNo(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800"
          >
            {Array.from({ length: maxLessons }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Bài {n}
              </option>
            ))}
          </select>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
          {(
            [
              { id: "vi", label: "Tiếng Việt" },
              { id: "bilingual", label: "Song ngữ (VI + EN)" },
              { id: "en", label: "Tiếng Anh (100%)" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLangMode(item.id)}
              className={`rounded-md px-3 py-1.5 transition ${
                langMode === item.id
                  ? "bg-teal-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !mindmap || !rootNode ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Đang dựng sơ đồ tư duy KHTN {grade} · Bài {lessonNo}...
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Interactive Mindmap Graph Canvas */}
          <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            {/* Root Lesson Node */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => setSelectedNode(rootNode)}
                className="max-w-lg rounded-2xl border-2 border-teal-600 bg-teal-700 px-6 py-4 text-center text-white shadow-md transition hover:bg-teal-800"
              >
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-teal-100">
                  <GitBranch className="h-4 w-4" />
                  TÂM BÀI HỌC
                </div>
                <div className="mt-1 text-lg font-extrabold">{renderPrimaryLabel(rootNode)}</div>
                {langMode === "bilingual" && (
                  <div className="mt-0.5 text-xs text-teal-100">{rootNode.label_vi}</div>
                )}
              </button>
              <div className="h-6 w-0.5 bg-teal-300" />
            </div>

            {/* Term Branches */}
            <div>
              <div className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                Nhánh Thuật ngữ Cốt lõi ({termNodes.length})
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {termNodes.map((node) => {
                  const active = selectedNode?.id === node.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => {
                        setSelectedNode(node);
                        speakEnglishTerm(node.label_en);
                      }}
                      className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                        active
                          ? "border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20"
                          : "border-slate-200 bg-slate-50/70 hover:border-teal-400"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">
                          {renderPrimaryLabel(node)}
                        </span>
                        <Volume2 className="h-4 w-4 shrink-0 text-teal-700" />
                      </div>
                      {langMode === "bilingual" && (
                        <span className="mt-0.5 text-xs font-medium text-teal-800">
                          {node.label_vi}
                        </span>
                      )}
                      {node.formula_or_symbol && (
                        <span className="formula-pill mt-2 rounded bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-900">
                          {node.formula_or_symbol}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cross-discipline Integration Branches */}
            {integrationNodes.length > 0 && (
              <div className="border-t border-dashed border-slate-200 pt-5">
                <div className="mb-3 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700">
                  <Link2 className="h-3.5 w-3.5" />
                  Nhánh Tích hợp Liên phân môn (CV 5208)
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {integrationNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => {
                        if (node.target_lesson_no && node.target_lesson_no <= maxLessons) {
                          setLessonNo(node.target_lesson_no);
                        }
                      }}
                      className="rounded-xl border border-dashed border-teal-400 bg-teal-50/50 p-3.5 text-left transition hover:bg-teal-100/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-teal-900">
                          {renderPrimaryLabel(node)}
                        </span>
                        <DisciplineBadge discipline={node.discipline} />
                      </div>
                      {node.note && <p className="mt-1.5 text-xs text-slate-600">{node.note}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Node Inspector */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:h-fit">
            {selectedNode ? (
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase text-slate-400">
                  Chi tiết Nút Khái niệm
                </div>
                <h3 className="text-xl font-bold text-slate-900">{selectedNode.label_en}</h3>
                <div className="text-sm font-semibold text-teal-800">{selectedNode.label_vi}</div>
                {selectedNode.ipa && (
                  <div className="formula-pill text-xs text-slate-500">{selectedNode.ipa}</div>
                )}
                {selectedNode.formula_or_symbol && (
                  <div className="formula-pill inline-block rounded bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-900">
                    {selectedNode.formula_or_symbol}
                  </div>
                )}
                {selectedNode.note && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    {selectedNode.note}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => speakEnglishTerm(selectedNode.label_en)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  <Volume2 className="h-4 w-4" />
                  Nghe phát âm Tiếng Anh
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Chọn nút bất kỳ trên sơ đồ.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
