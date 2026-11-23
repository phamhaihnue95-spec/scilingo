import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, Gamepad2, KeyRound, Play, Sparkles } from "lucide-react";

import { api } from "../../api/client";
import type {
  AssignmentItem,
  AssignmentTake,
  ClassroomGameChallenge,
  GameType,
  SubmissionResult,
} from "../../api/types";
import { playClickSound } from "../../utils/soundFx";
import { emitPetFocusMode } from "../../utils/petEvents";

interface Props {
  onLaunchGameChallenge?: (
    game: "lightning" | "iupac" | "sequence",
    unitNo?: number
  ) => void;
}

function mapGameTypeToArenaTab(gameType: GameType): "lightning" | "iupac" | "sequence" {
  if (gameType === "iupac_lab") return "iupac";
  if (gameType === "sequence_lab") return "sequence";
  return "lightning";
}

export function StudentAssignmentsPanel({ onLaunchGameChallenge }: Props) {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [challenges, setChallenges] = useState<ClassroomGameChallenge[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [taking, setTaking] = useState<AssignmentTake | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAssignments = () => {
    setLoading(true);
    Promise.all([api.listMyAssignments(), api.listMyGameChallenges()])
      .then(([items, challengeItems]) => {
        setAssignments(items);
        setChallenges(challengeItems);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  useEffect(() => {
    emitPetFocusMode(Boolean(taking));
    return () => emitPetFocusMode(false);
  }, [taking]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setError(null);
    setMessage(null);
    try {
      const joined = await api.joinClassroom(joinCode.trim());
      setJoinCode("");
      setMessage(`Đã tham gia lớp ${joined.name}.`);
      loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tham gia lớp.");
    }
  };

  const handleStartAssignment = async (assignmentId: string) => {
    setError(null);
    setResult(null);
    setAnswers({});
    try {
      const data = await api.takeAssignment(assignmentId);
      setTaking(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể mở đề kiểm tra.");
    }
  };

  const handleSubmit = async () => {
    if (!taking) return;
    setError(null);
    try {
      const payload = Object.entries(answers).map(([question_id, selected_index]) => ({
        question_id,
        selected_index,
      }));
      const res = await api.submitAssignment(taking.assignment_id, payload);
      setResult(res);
      setTaking(null);
      loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể nộp bài.");
    }
  };

  if (taking) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h3 className="font-bold text-slate-900">{taking.title}</h3>
            <p className="text-xs text-slate-500">
              {taking.classroom_name} · {taking.duration_minutes} phút ·{" "}
              {Math.round(taking.achieved_en_ratio * 100)}% Tiếng Anh
            </p>
          </div>
          <span className="text-xs font-bold text-teal-800">
            Đã chọn {Object.keys(answers).length}/{taking.questions.length} câu
          </span>
        </div>

        {taking.questions.map((q) => (
          <div key={q.question_id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex justify-between text-xs font-bold">
              <span className={q.language === "en" ? "text-teal-800" : "text-slate-600"}>
                Câu {q.order_no} ({q.language.toUpperCase()})
              </span>
              <span className="text-slate-500">{q.points} điểm</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{q.prompt_text}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((opt, idx) => (
                <button
                  key={`${q.question_id}-${idx}`}
                  type="button"
                  onClick={() => setAnswers((p) => ({ ...p, [q.question_id]: idx }))}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    answers[q.question_id] === idx
                      ? "border-teal-600 bg-teal-50 font-semibold text-teal-900"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setTaking(null)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Quay lại
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="rounded-xl bg-teal-700 px-6 py-2 text-sm font-bold text-white hover:bg-teal-800"
          >
            Nộp bài cho Giáo viên
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => void handleJoin(e)}
        className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-white/95 p-4 shadow-sm sm:flex-row sm:items-center"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <KeyRound className="h-4 w-4 text-indigo-600" />
          Tham gia lớp bằng mã:
        </div>
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Nhập mã lớp (vd: KHTN8-CGB8)"
          className="flex-1 rounded-xl border border-sky-200 px-3 py-1.5 text-sm uppercase focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-1.5 text-sm font-bold text-white shadow-sm hover:opacity-95"
        >
          Vào lớp
        </button>
      </form>

      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Đã nộp bài thành công: {result.score} / {result.max_score} điểm
          </div>
          <p className="mt-1 text-xs">
            Phần Tiếng Việt: <strong>{result.vi_score}</strong> điểm · Phần Tiếng Anh:{" "}
            <strong>{result.en_score}</strong> điểm
          </p>
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Teacher Mini-Game Challenges */}
      {!loading && challenges.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Gamepad2 className="h-4 w-4 text-orange-600" />
              Thử Thách Mini-Game 5 phút từ Cô Phạm Thị Hải
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-950">
              <Sparkles className="h-3 w-3" />
              {challenges.length} nhiệm vụ đang mở
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {challenges.map((ch) => (
              <div
                key={ch.id}
                className="flex flex-col justify-between rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-indigo-700">{ch.classroom_name}</span>
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 font-extrabold text-orange-800">
                      Mục tiêu {ch.target_score}đ · {ch.duration_minutes} phút
                    </span>
                  </div>
                  <h4 className="mt-1.5 text-sm font-extrabold text-slate-900">{ch.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{ch.instructions}</p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                  <span className="font-semibold text-slate-500">Giao bởi {ch.created_by_name}</span>
                  {onLaunchGameChallenge && (
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        onLaunchGameChallenge(
                          mapGameTypeToArenaTab(ch.game_type),
                          ch.unit_no ?? undefined
                        );
                      }}
                      className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border-amber-800 bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-1.5 text-xs font-extrabold text-white shadow"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Chơi thử thách ngay!
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Đang tải bài tập lớp học...
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          <ClipboardCheck className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          Chưa có bài kiểm tra nào được giao cho lớp của bạn. Hãy tham gia lớp (mã{" "}
          <code className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono font-bold text-indigo-700">
            KHTN8-CGB8
          </code>
          ) hoặc nhờ cô Phạm Thị Hải giao đề từ Teacher Studio!
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-teal-800">{a.classroom_name}</span>
                  <span className="rounded bg-teal-50 px-2 py-0.5 font-bold text-teal-900">
                    {Math.round(a.achieved_en_ratio * 100)}% EN
                  </span>
                </div>
                <h4 className="mt-1.5 font-bold text-slate-900">{a.title}</h4>
                <p className="mt-1 text-xs text-slate-500">
                  {a.duration_minutes} phút · Thang {a.total_points} điểm
                </p>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                {a.submitted ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Đã nộp · Điểm: {a.student_score}/{a.total_points}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleStartAssignment(a.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-800"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Làm bài ngay
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
