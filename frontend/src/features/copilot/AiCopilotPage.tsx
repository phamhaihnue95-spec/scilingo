import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  Bot,
  CheckCircle2,
  Mic,
  MicOff,
  PlusCircle,
  Send,
  ShieldAlert,
  Sparkles,
  Volume2,
} from "lucide-react";

import { api } from "../../api/client";
import type {
  AuthSession,
  ClilGenerateResult,
  CopilotLintResult,
  CopilotStatus,
  GradeLevel,
  PronunciationEvalResult,
  TutorAskResult,
} from "../../api/types";
import { VALID_GRADES } from "../../utils/grades";
import { speakEnglishTerm } from "../../utils/speech";

interface Props {
  session: AuthSession | null;
  grade: GradeLevel;
  onOpenAccount: () => void;
}

type CopilotTab = "tutor" | "linter" | "clil_gen" | "pronunciation";

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

export function AiCopilotPage({ session, grade, onOpenAccount }: Props) {
  const [tab, setTab] = useState<CopilotTab>("tutor");
  const [statusInfo, setStatusInfo] = useState<CopilotStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tutor state
  const [tutorGrade, setTutorGrade] = useState<GradeLevel>(grade);
  const [tutorLessonNo, setTutorLessonNo] = useState<string>("8");
  const [tutorQuestion, setTutorQuestion] = useState(
    "Giải thích khái niệm Acid và danh pháp Hydrochloric acid chuẩn IUPAC"
  );
  const [tutorResult, setTutorResult] = useState<TutorAskResult | null>(null);
  const [loadingTutor, setLoadingTutor] = useState(false);

  // Linter state
  const [lintText, setLintText] = useState(
    "Cho đinh sắt tác dụng với axit sunfuric loãng và kiểm tra ADN."
  );
  const [lintResult, setLintResult] = useState<CopilotLintResult | null>(null);
  const [loadingLint, setLoadingLint] = useState(false);

  // CLIL Generator state
  const [genGrade, setGenGrade] = useState<GradeLevel>(grade);
  const [genLessonNo, setGenLessonNo] = useState<number>(8);
  const [genLang, setGenLang] = useState<"en" | "vi" | "bilingual">("en");
  const [genLevel, setGenLevel] = useState<"know" | "understand" | "apply">("understand");
  const [genCount, setGenCount] = useState<number>(3);
  const [genFocus, setGenFocus] = useState("");
  const [genResult, setGenResult] = useState<ClilGenerateResult | null>(null);
  const [loadingGen, setLoadingGen] = useState(false);
  const [savedIndices, setSavedIndices] = useState<Record<number, boolean>>({});

  // Pronunciation state
  const [targetTerm, setTargetTerm] = useState("Hydrochloric acid");
  const [spokenText, setSpokenText] = useState("Hydrochloric acid");
  const [pronResult, setPronResult] = useState<PronunciationEvalResult | null>(null);
  const [loadingPron, setLoadingPron] = useState(false);
  const [listening, setListening] = useState(false);

  const isTeacherOrAdmin =
    session !== null &&
    (session.user.role === "teacher" ||
      session.user.role === "school_admin" ||
      session.user.role === "platform_admin");

  useEffect(() => {
    setTutorGrade(grade);
    setGenGrade(grade);
  }, [grade]);

  const loadStatus = () => {
    if (!session) return;
    api
      .copilotGetStatus()
      .then(setStatusInfo)
      .catch(() => {});
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  if (!session) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-violet-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
          <Bot className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">
          SciLingo AI Copilot Studio (Unit 4)
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Vui lòng đăng nhập để sử dụng Gia sư AI KHTN 6–9 bám sát SGK Kết nối tri thức, Trình kiểm
          chuẩn IUPAC/SI, Sinh câu hỏi CLIL và Luyện phát âm AI.
        </p>
        <button
          type="button"
          onClick={onOpenAccount}
          className="mt-5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  const handleAskTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingTutor(true);
    setError(null);
    try {
      const parsedLesson = tutorLessonNo.trim() ? Number(tutorLessonNo.trim()) : null;
      const res = await api.copilotAskTutor({
        grade: tutorGrade,
        lesson_no: parsedLesson && !Number.isNaN(parsedLesson) ? parsedLesson : null,
        question: tutorQuestion,
        response_mode: "bilingual",
      });
      setTutorResult(res);
      loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gọi được Gia sư AI.");
    } finally {
      setLoadingTutor(false);
    }
  };

  const handleLintText = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingLint(true);
    setError(null);
    try {
      const res = await api.copilotLintTerminology(lintText);
      setLintResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kiểm chuẩn thuật ngữ thất bại.");
    } finally {
      setLoadingLint(false);
    }
  };

  const handleGenerateClil = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingGen(true);
    setError(null);
    setSavedIndices({});
    try {
      const res = await api.copilotGenerateClilQuestions({
        grade: genGrade,
        lesson_no: genLessonNo,
        language: genLang,
        cognitive_level: genLevel,
        count: genCount,
        focus_topic: genFocus.trim() || null,
      });
      setGenResult(res);
      loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không sinh được câu hỏi CLIL.");
    } finally {
      setLoadingGen(false);
    }
  };

  const handleSaveGeneratedQuestion = async (idx: number) => {
    if (!genResult) return;
    const q = genResult.questions[idx];
    setError(null);
    try {
      await api.createQuestion({
        grade: q.grade,
        lesson_no: q.lesson_no,
        language: q.language,
        cognitive_level: q.cognitive_level,
        discipline: q.discipline,
        prompt_text: q.prompt_text,
        options: q.options,
        correct_index: q.correct_index,
        explanation_vi: q.explanation_vi,
      });
      setSavedIndices((prev) => ({ ...prev, [idx]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu câu hỏi vào Ngân hàng thất bại.");
    }
  };

  const handleEvaluatePronunciation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPron(true);
    setError(null);
    try {
      const res = await api.copilotEvaluatePronunciation({
        target_term: targetTerm,
        spoken_transcript: spokenText,
      });
      setPronResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đánh giá được phát âm.");
    } finally {
      setLoadingPron(false);
    }
  };

  const startVoiceCapture = () => {
    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Trình duyệt chưa hỗ trợ thu âm SpeechRecognition — bạn có thể gõ transcript để chấm.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript ?? "";
      if (text) setSpokenText(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-r from-violet-700 via-indigo-700 to-sky-600 p-5 text-white shadow-md">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide">
            <Bot className="h-3.5 w-3.5" />
            Unit 4 · SciLingo AI Copilot
          </div>
          <h1 className="mt-1.5 text-xl font-extrabold sm:text-2xl">
            Trợ lý AI Song ngữ KHTN 6–9 &amp; Kiểm chuẩn IUPAC/SI
          </h1>
          <p className="text-xs text-violet-100">
            Mọi phản hồi AI đều khóa trong phạm vi KHTN KNTT và kiểm chuẩn qua Linter Thông tư 32/2018.
          </p>
        </div>

        {statusInfo && (
          <div className="rounded-2xl bg-white/15 px-4 py-2 text-right text-xs backdrop-blur-sm">
            <div className="font-bold">
              Chế độ:{" "}
              {statusInfo.provider_mode === "gemini" ? "Gemini Grounded RAG" : "Grounded RAG KHTN"}
            </div>
            <div className="text-violet-100">
              AI Quota tháng: <strong>{statusInfo.ai_remaining}</strong> /{" "}
              {statusInfo.ai_monthly_quota} lượt
            </div>
          </div>
        )}
      </div>

      {/* Sub Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["tutor", "Gia sư KHTN 6–9"],
            ["linter", "Kiểm chuẩn IUPAC/SI"],
            ...(isTeacherOrAdmin ? ([["clil_gen", "Sinh câu hỏi CLIL"]] as const) : []),
            ["pronunciation", "Luyện phát âm AI"],
          ] as Array<[CopilotTab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              tab === key
                ? "bg-violet-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Tab 1: Grounded Tutor */}
      {tab === "tutor" && (
        <div className="space-y-4">
          <form
            onSubmit={handleAskTutor}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Khối lớp KHTN</span>
                <select
                  value={tutorGrade}
                  onChange={(e) => setTutorGrade(Number(e.target.value) as GradeLevel)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                >
                  {VALID_GRADES.map((g) => (
                    <option key={g} value={g}>
                      KHTN Lớp {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Số bài học (tùy chọn)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={tutorLessonNo}
                  onChange={(e) => setTutorLessonNo(e.target.value)}
                  placeholder="vd: 8"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                />
              </label>
              <div className="sm:col-span-2 flex items-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setTutorQuestion(
                      "Phân biệt Acid và Base, giải thích tại sao dùng Sodium hydroxide thay cho natri hiđroxit?"
                    )
                  }
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100"
                >
                  Gợi ý: Acid &amp; IUPAC
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTutorQuestion("Định nghĩa Pressure và đơn vị SI chuẩn (Pa) trong Vật lí")
                  }
                  className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100"
                >
                  Gợi ý: Áp suất (SI)
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                required
                minLength={3}
                value={tutorQuestion}
                onChange={(e) => setTutorQuestion(e.target.value)}
                placeholder="Đặt câu hỏi KHTN 6–9 (tiếng Việt hoặc tiếng Anh)..."
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs"
              />
              <button
                type="submit"
                disabled={loadingTutor}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                {loadingTutor ? "Đang tra cứu SGK..." : "Hỏi Gia sư AI"}
              </button>
            </div>
          </form>

          {tutorResult && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    tutorResult.on_topic
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {tutorResult.on_topic ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}
                  {tutorResult.on_topic
                    ? `Đạt kiểm chuẩn IUPAC/SI (${tutorResult.provider})`
                    : "Ngoài phạm vi KHTN 6–9"}
                </span>
                <span className="text-xs text-slate-500">
                  Quota còn lại: <strong>{tutorResult.quota_remaining}</strong>
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-800">
                  <div className="mb-1 font-extrabold text-indigo-700">Giải thích tiếng Việt</div>
                  <div className="whitespace-pre-line">{tutorResult.answer_vi}</div>
                </div>
                <div className="rounded-xl bg-indigo-50/60 p-3.5 text-xs leading-relaxed text-slate-800">
                  <div className="mb-1 font-extrabold text-violet-700">Bilingual English</div>
                  <div className="whitespace-pre-line">{tutorResult.answer_en}</div>
                </div>
              </div>

              {tutorResult.citations.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
                    <BookMarked className="h-3.5 w-3.5 text-indigo-600" />
                    Nguồn SGK &amp; Từ điển đã đối chiếu ({tutorResult.citations.length})
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {tutorResult.citations.map((cit, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px]"
                      >
                        <div className="font-bold text-slate-900">{cit.title}</div>
                        <div className="text-slate-600">{cit.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: IUPAC / SI Terminology Linter */}
      {tab === "linter" && (
        <div className="space-y-4">
          <form
            onSubmit={handleLintText}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="text-xs font-bold text-slate-700">
              Dán giáo án, slide hoặc câu hỏi để kiểm tra danh pháp IUPAC (Thông tư 32/2018), 13
              nguyên tố ngoại lệ &amp; đơn vị SI:
            </div>
            <textarea
              rows={4}
              required
              value={lintText}
              onChange={(e) => setLintText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={loadingLint}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700"
              >
                {loadingLint ? "Đang quét..." : "Kiểm chuẩn IUPAC / SI"}
              </button>
              <button
                type="button"
                onClick={() => setLintText("Cho đinh sắt vào sắt(III) sunfat và axit sunfuric.")}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Thử mẫu bẫy 13 nguyên tố
              </button>
            </div>
          </form>

          {lintResult && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                {lintResult.passed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Đạt chuẩn IUPAC / SI
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {lintResult.error_count} lỗi cần sửa · {lintResult.warning_count} lưu ý
                  </span>
                )}
              </div>

              {lintResult.issues.length > 0 && (
                <ul className="space-y-1.5 text-xs">
                  {lintResult.issues.map((iss, idx) => (
                    <li
                      key={idx}
                      className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-slate-800"
                    >
                      <strong>"{iss.matched_text}"</strong> → nên dùng{" "}
                      <span className="font-bold text-emerald-700">{iss.recommended}</span> ·{" "}
                      {iss.reason}
                    </li>
                  ))}
                </ul>
              )}

              {lintResult.exception_notes.length > 0 && (
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  {lintResult.exception_notes.map((n, i) => (
                    <div key={i}>• {n}</div>
                  ))}
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-xs">
                <div className="mb-1 font-bold text-slate-700">Bản gợi ý sau khi chuẩn hóa:</div>
                <div className="font-mono text-emerald-800">{lintResult.corrected_preview}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: CLIL Question Generator (Teacher/Admin) */}
      {tab === "clil_gen" && isTeacherOrAdmin && (
        <div className="space-y-4">
          <form
            onSubmit={handleGenerateClil}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3"
          >
            <label className="space-y-1 text-xs font-bold text-slate-700">
              <span>Khối lớp</span>
              <select
                value={genGrade}
                onChange={(e) => setGenGrade(Number(e.target.value) as GradeLevel)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
              >
                {VALID_GRADES.map((g) => (
                  <option key={g} value={g}>
                    KHTN Lớp {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-700">
              <span>Bài số</span>
              <input
                type="number"
                min={1}
                max={60}
                value={genLessonNo}
                onChange={(e) => setGenLessonNo(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
              />
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-700">
              <span>Ngôn ngữ câu hỏi</span>
              <select
                value={genLang}
                onChange={(e) => setGenLang(e.target.value as "en" | "vi" | "bilingual")}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
              >
                <option value="en">100% Tiếng Anh (EN)</option>
                <option value="bilingual">Song ngữ (EN + VI)</option>
                <option value="vi">Tiếng Việt chuẩn IUPAC</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-700">
              <span>Mức độ nhận thức</span>
              <select
                value={genLevel}
                onChange={(e) => setGenLevel(e.target.value as "know" | "understand" | "apply")}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
              >
                <option value="know">Nhận biết (Know)</option>
                <option value="understand">Thông hiểu (Understand)</option>
                <option value="apply">Vận dụng (Apply)</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-700">
              <span>Số câu (1–6)</span>
              <input
                type="number"
                min={1}
                max={6}
                value={genCount}
                onChange={(e) => setGenCount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
              />
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-700">
              <span>Chủ đề trọng tâm (tùy chọn)</span>
              <input
                value={genFocus}
                onChange={(e) => setGenFocus(e.target.value)}
                placeholder="vd: Hydrochloric acid..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
              />
            </label>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={loadingGen}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
              >
                <Sparkles className="h-4 w-4" />
                {loadingGen ? "Đang sinh câu hỏi..." : "Sinh câu hỏi CLIL & Kiểm chuẩn Linter"}
              </button>
            </div>
          </form>

          {genResult && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700">
                KHTN {genResult.grade} · Bài {genResult.lesson_no}: {genResult.lesson_title_vi} (
                {genResult.lesson_title_en})
              </div>
              {genResult.questions.map((q, idx) => (
                <div
                  key={idx}
                  className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-extrabold text-indigo-700">
                      Câu {idx + 1} · {q.language.toUpperCase()} · {q.cognitive_level}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          q.linter_verified
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {q.linter_verified ? "Linter Verified" : "Cần rà lại IUPAC"}
                      </span>
                      <button
                        type="button"
                        disabled={Boolean(savedIndices[idx])}
                        onClick={() => handleSaveGeneratedQuestion(idx)}
                        className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        {savedIndices[idx] ? "Đã lưu vào Ngân hàng" : "Lưu vào Ngân hàng câu hỏi"}
                      </button>
                    </div>
                  </div>
                  <div className="font-bold text-slate-900">{q.prompt_text}</div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={`rounded-lg border px-2.5 py-1.5 ${
                          optIdx === q.correct_index
                            ? "border-emerald-300 bg-emerald-50 font-bold text-emerald-900"
                            : "border-slate-100 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}. {opt}
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-600">{q.explanation_vi}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Pronunciation Coach */}
      {tab === "pronunciation" && (
        <div className="space-y-4">
          <form
            onSubmit={handleEvaluatePronunciation}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Thuật ngữ mục tiêu (EN)</span>
                <div className="flex gap-2">
                  <input
                    required
                    value={targetTerm}
                    onChange={(e) => setTargetTerm(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => speakEnglishTerm(targetTerm)}
                    title="Nghe phát âm mẫu"
                    className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sky-700 hover:bg-sky-100"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
              </label>

              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Câu em vừa đọc (thu micro hoặc gõ)</span>
                <div className="flex gap-2">
                  <input
                    required
                    value={spokenText}
                    onChange={(e) => setSpokenText(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                  />
                  <button
                    type="button"
                    onClick={startVoiceCapture}
                    title="Thu âm bằng Micro"
                    className={`rounded-xl px-3 py-2 text-xs font-bold ${
                      listening
                        ? "bg-rose-600 text-white"
                        : "border border-violet-200 bg-violet-50 text-violet-700"
                    }`}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={loadingPron}
              className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white hover:bg-violet-700"
            >
              {loadingPron ? "Đang chấm..." : "Chấm điểm phát âm"}
            </button>
          </form>

          {pronResult && (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-lg font-extrabold text-indigo-700">
                    {pronResult.score}/100
                  </span>{" "}
                  <span className="ml-2 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                    {pronResult.grade_band}
                  </span>
                </div>
                {pronResult.ipa && (
                  <span className="font-mono text-sky-700">{pronResult.ipa}</span>
                )}
              </div>
              <div className="font-semibold text-slate-800">{pronResult.feedback_vi}</div>
              <div className="text-slate-600">{pronResult.feedback_en}</div>
              <ul className="list-disc pl-5 text-slate-700">
                {pronResult.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
