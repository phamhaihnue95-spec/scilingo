import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Gamepad2,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";

import { api, saveAuthTokens } from "../../api/client";
import type {
  AuthSession,
  Classroom,
  ClassroomAnalytics,
  ClassroomGameChallenge,
  ClassroomLeaderboard,
  ClilMode,
  ExamDetail,
  ExamSummary,
  GameType,
  GradeLevel,
  TT94ComplianceReport,
  TeacherResource,
  TeachingSessionLog,
} from "../../api/types";
import { ScienceAmbientParticles } from "../../components/motion/MotionPrimitives";
import { GRADE_LESSON_COUNTS, VALID_GRADES, normalizeGrade } from "../../utils/grades";
import { playClickSound, playSuccessSound } from "../../utils/soundFx";
import { ClassroomLeaderboardPanel } from "../games/ClassroomLeaderboardPanel";

interface Props {
  session: AuthSession | null;
  grade?: GradeLevel;
  onSessionChange: (session: AuthSession) => void;
}

type StudioTab = "resources" | "exam_builder" | "classrooms" | "tt94_report";

const GRADE_LESSON_PRESETS: Record<GradeLevel, string> = {
  6: "1, 8, 17, 22, 41",
  7: "2, 5, 8, 22, 30",
  8: "8, 9, 10, 13, 18",
  9: "2, 6, 18, 22, 36",
};

export function TeacherStudioPage({ session, grade = 8, onSessionChange }: Props) {
  const [tab, setTab] = useState<StudioTab>("exam_builder");
  const [studioGrade, setStudioGrade] = useState<GradeLevel>(grade);
  const [newClassGrade, setNewClassGrade] = useState<GradeLevel>(grade);
  const [loggingIn, setLoggingIn] = useState(false);

  const studioMaxLessons = GRADE_LESSON_COUNTS[studioGrade];

  // Resources state
  const [resourceLesson, setResourceLesson] = useState(() =>
    Math.min(8, GRADE_LESSON_COUNTS[grade])
  );
  const [resources, setResources] = useState<TeacherResource[]>([]);
  const [selectedResource, setSelectedResource] = useState<TeacherResource | null>(null);

  // Exam Builder state
  const [examTitle, setExamTitle] = useState(
    () => `Kiểm tra giữa kỳ KHTN ${grade} (Chuẩn Thông tư 94)`
  );
  const [examSourceMode, setExamSourceMode] = useState<"kntt" | "study_pack" | "both">("both");
  const [lessonRangeText, setLessonRangeText] = useState(() => GRADE_LESSON_PRESETS[grade]);
  const [studyPackRangeText, setStudyPackRangeText] = useState("1, 7, 14");
  const [targetRatio, setTargetRatio] = useState<number>(0.5);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [generatedExam, setGeneratedExam] = useState<ExamDetail | null>(null);
  const [examHistory, setExamHistory] = useState<ExamSummary[]>([]);
  const [assignClassroomId, setAssignClassroomId] = useState<string>("");

  // Custom question quick form
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [qLessonNo, setQLessonNo] = useState(8);
  const [qLang, setQLang] = useState<"vi" | "en">("en");
  const [qPrompt, setQPrompt] = useState("");
  const [qOpt0, setQOpt0] = useState("");
  const [qOpt1, setQOpt1] = useState("");
  const [qOpt2, setQOpt2] = useState("");
  const [qOpt3, setQOpt3] = useState("");
  const [qCorrectIdx, setQCorrectIdx] = useState(0);

  // Classrooms & Analytics
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("");
  const [analytics, setAnalytics] = useState<ClassroomAnalytics | null>(null);
  const [leaderboard, setLeaderboard] = useState<ClassroomLeaderboard | null>(null);
  const [challenges, setChallenges] = useState<ClassroomGameChallenge[]>([]);
  const [challengeTitle, setChallengeTitle] = useState(
    "Thử thách 5 phút: Chinh phục từ vựng KHTN 8"
  );
  const [challengeGameType, setChallengeGameType] = useState<GameType>("lightning_match");
  const [challengeUnitNo, setChallengeUnitNo] = useState<number>(1);
  const [challengeTargetScore, setChallengeTargetScore] = useState<number>(120);
  const [challengeNotes, setChallengeNotes] = useState<string>(
    "Hoàn thành trò chơi để ghi danh lên Bảng Vàng Lớp 8A1 nhé! — Cô Phạm Thị Hải"
  );

  // TT94 Logging & Report
  const [report, setReport] = useState<TT94ComplianceReport | null>(null);
  const [sessions, setSessions] = useState<TeachingSessionLog[]>([]);
  const [logClassroomId, setLogClassroomId] = useState("");
  const [logLessonNo, setLogLessonNo] = useState(8);
  const [logPeriods, setLogPeriods] = useState(2);
  const [logMinutes, setLogMinutes] = useState(30);
  const [logMode, setLogMode] = useState<ClilMode>("bilingual_10");
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logNotes, setLogNotes] = useState("");

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedLogClass = classrooms.find((c) => c.id === logClassroomId);
  const logGrade: GradeLevel = normalizeGrade(selectedLogClass?.grade ?? studioGrade);
  const logMaxLessons = GRADE_LESSON_COUNTS[logGrade];

  const applyStudioGrade = (nextGrade: GradeLevel) => {
    const nextMax = GRADE_LESSON_COUNTS[nextGrade];
    setStudioGrade(nextGrade);
    setExamTitle(`Kiểm tra giữa kỳ KHTN ${nextGrade} (Chuẩn Thông tư 94)`);
    setLessonRangeText(GRADE_LESSON_PRESETS[nextGrade]);
    setResourceLesson((prev) => Math.min(Math.max(1, prev), nextMax));
    setQLessonNo((prev) => Math.min(Math.max(1, prev), nextMax));
  };

  useEffect(() => {
    applyStudioGrade(grade);
    setNewClassGrade(grade);
  }, [grade]);

  useEffect(() => {
    setLogLessonNo((prev) => Math.min(Math.max(1, prev), logMaxLessons));
  }, [logMaxLessons]);

  const isTeacherOrAdmin =
    session?.user.role === "teacher" ||
    session?.user.role === "school_admin" ||
    session?.user.role === "platform_admin";

  const loadClassroomDetails = async (cid: string) => {
    setSelectedClassroomId(cid);
    try {
      const [anData, lbData, chList] = await Promise.all([
        api.getClassroomAnalytics(cid),
        api.getClassroomLeaderboard(cid),
        api.listClassroomGameChallenges(cid),
      ]);
      setAnalytics(anData);
      setLeaderboard(lbData);
      setChallenges(chList);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không tải được dữ liệu lớp.");
    }
  };

  const loadTeacherWorkspace = async () => {
    if (!isTeacherOrAdmin) return;
    try {
      const [clsList, exList, rep, logList] = await Promise.all([
        api.listClassrooms(),
        api.listExams(),
        api.getTT94ComplianceReport(),
        api.listTeachingSessions(),
      ]);
      setClassrooms(clsList);
      setExamHistory(exList);
      setReport(rep);
      setSessions(logList);
      if (clsList.length > 0) {
        setAssignClassroomId((prev) => prev || clsList[0].id);
        setLogClassroomId((prev) => prev || clsList[0].id);
        const targetId =
          selectedClassroomId && clsList.some((c) => c.id === selectedClassroomId)
            ? selectedClassroomId
            : clsList[0].id;
        void loadClassroomDetails(targetId);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không tải được dữ liệu LMS.");
    }
  };

  useEffect(() => {
    void loadTeacherWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  useEffect(() => {
    if (!isTeacherOrAdmin) return;
    const clampedLesson = Math.min(Math.max(1, resourceLesson), GRADE_LESSON_COUNTS[studioGrade]);
    api
      .getLessonResources(clampedLesson, studioGrade)
      .then((res) => {
        setResources(res);
        setSelectedResource(res[0] ?? null);
      })
      .catch(() => setResources([]));
  }, [resourceLesson, studioGrade, isTeacherOrAdmin]);

  const handleDemoLogin = async (email: string, password: string) => {
    setLoggingIn(true);
    setErrorMsg(null);
    try {
      const next = await api.login({ email, password });
      saveAuthTokens(next.access_token, next.refresh_token);
      onSessionChange(next);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setLoggingIn(false);
    }
  };

  if (!isTeacherOrAdmin) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Teacher Studio & LMS (Dành cho Giáo viên / Ban Giám hiệu)
            </h1>
            <p className="mt-1 text-sm text-slate-700">
              {session
                ? `Bạn đang đăng nhập bằng tài khoản học sinh (${session.user.full_name}). Vui lòng chuyển sang tài khoản Giáo viên hoặc Ban Giám hiệu để soạn giáo án CLIL, tạo đề kiểm tra 10%–50% và xem báo cáo Thông tư 94/2026.`
                : "Đăng nhập nhanh bằng tài khoản Giáo viên KHTN Phạm Thị Hải hoặc Ban Giám hiệu Trường THCS Cầu Giấy B để trải nghiệm trọn bộ Unit 3."}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={loggingIn}
            onClick={() => void handleDemoLogin("hai.gv@demo.scilingo.vn", "Teacher123!")}
            className="flex items-center justify-between rounded-xl border border-indigo-300 bg-white p-4 text-left shadow-sm transition hover:border-indigo-600"
          >
            <div>
              <div className="font-bold text-slate-900">Cô Phạm Thị Hải (Giáo viên)</div>
              <div className="text-xs text-slate-500">hai.gv@demo.scilingo.vn</div>
            </div>
            <UserCheck className="h-5 w-5 text-indigo-700" />
          </button>

          <button
            type="button"
            disabled={loggingIn}
            onClick={() => void handleDemoLogin("hung.bgh@demo.scilingo.vn", "Admin123!")}
            className="flex items-center justify-between rounded-xl border border-teal-300 bg-white p-4 text-left shadow-sm hover:border-teal-600"
          >
            <div>
              <div className="font-bold text-slate-900">Thầy Trần Quốc Hùng (Hiệu phó)</div>
              <div className="text-xs text-slate-500">hung.bgh@demo.scilingo.vn</div>
            </div>
            <UserCheck className="h-5 w-5 text-teal-700" />
          </button>
        </div>
      </div>
    );
  }

  const handleGenerateExam = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    const parsedLessons =
      examSourceMode === "study_pack"
        ? []
        : lessonRangeText
            .split(/[,\s]+/)
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= studioMaxLessons);

    const parsedUnits =
      examSourceMode === "kntt"
        ? []
        : studyPackRangeText
            .split(/[,\s]+/)
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 16);

    if (parsedLessons.length === 0 && parsedUnits.length === 0) {
      setErrorMsg(
        `Vui lòng nhập ít nhất 1 bài SGK KNTT ${studioGrade} (1–${studioMaxLessons}) hoặc 1 chuyên đề Bộ Đề 16 Units (1–16).`
      );
      return;
    }

    setBusy(true);
    try {
      const detail = await api.generateExam({
        title: examTitle,
        grade: studioGrade,
        lesson_nos: parsedLessons,
        study_pack_unit_nos: parsedUnits,
        classroom_id: assignClassroomId || null,
        target_en_ratio: targetRatio,
        total_points: 10,
        question_count: questionCount,
        duration_minutes: durationMinutes,
      });
      setGeneratedExam(detail);
      setStatusMsg(
        `Đã tạo đề KHTN ${detail.grade ?? studioGrade} "${detail.title}" — ${detail.en_points}/${detail.total_points} điểm Tiếng Anh (${Math.round(detail.achieved_en_ratio * 100)}%).`
      );
      await loadTeacherWorkspace();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không thể sinh đề kiểm tra.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCustomQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      await api.createQuestion({
        grade: studioGrade,
        lesson_no: qLessonNo,
        language: qLang,
        cognitive_level: "know",
        discipline: "chemistry",
        prompt_text: qPrompt,
        options: [qOpt0, qOpt1, qOpt2, qOpt3],
        correct_index: qCorrectIdx,
        explanation_vi: "Câu hỏi do giáo viên biên soạn.",
      });
      setQPrompt("");
      setQOpt0("");
      setQOpt1("");
      setQOpt2("");
      setQOpt3("");
      setShowAddQuestion(false);
      setStatusMsg(
        `Đã lưu câu hỏi KHTN ${studioGrade} mới vào ngân hàng của trường cho Bài ${qLessonNo}.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không lưu được câu hỏi.");
    } finally {
      setBusy(false);
    }
  };

  const handleAssignGeneratedExam = async () => {
    if (!generatedExam || !assignClassroomId) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const assigned = await api.assignExam(assignClassroomId, generatedExam.id);
      setStatusMsg(`Đã giao đề "${assigned.title}" cho lớp ${assigned.classroom_name}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không giao được bài cho lớp.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const created = await api.createClassroom({
        name: newClassName.trim(),
        grade: newClassGrade,
        academic_year: "2026-2027",
        is_tt94_pilot_class: true,
      });
      setNewClassName("");
      setStatusMsg(
        `Đã tạo lớp ${created.name} (Khối ${created.grade} · Mã tham gia: ${created.join_code}).`
      );
      await loadTeacherWorkspace();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không thể tạo lớp mới.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateGameChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassroomId || !challengeTitle.trim()) return;
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const created = await api.createGameChallenge(selectedClassroomId, {
        title: challengeTitle.trim(),
        game_type: challengeGameType,
        unit_no: challengeGameType === "lightning_match" ? challengeUnitNo : undefined,
        target_score: challengeTargetScore,
        duration_minutes: 5,
        instructions: challengeNotes.trim(),
      });
      playSuccessSound(2);
      setStatusMsg(`Đã giao thử thách "${created.title}" tới lớp ${created.classroom_name}.`);
      const chList = await api.listClassroomGameChallenges(selectedClassroomId);
      setChallenges(chList);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không giao được thử thách mini-game.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logClassroomId) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await api.logTeachingSession({
        classroom_id: logClassroomId,
        grade: logGrade,
        lesson_no: logLessonNo,
        taught_date: logDate,
        periods_count: logPeriods,
        clil_mode: logMode,
        english_minutes: logMinutes,
        notes: logNotes || undefined,
      });
      setLogNotes("");
      setStatusMsg("Đã ghi nhận tiết dạy KHTN song ngữ vào hồ sơ Thông tư 94/2026.");
      await loadTeacherWorkspace();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không lưu được nhật ký tiết dạy.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadResourceMd = (res: TeacherResource) => {
    const blob = new Blob([res.content_markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${res.id}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 via-blue-600 to-teal-500 p-6 text-white shadow-lg">
        <ScienceAmbientParticles />
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-sky-100">
              Unit 3 · Teacher Studio, LMS & Hồ sơ Thông tư 94/2026/TT-BGDĐT
            </div>
            <h1 className="mt-1 text-2xl font-extrabold">{session.tenant.name}</h1>
            <p className="mt-1 text-xs text-sky-50">
              Giáo viên phụ trách: <strong>{session.user.full_name}</strong> ({session.user.role}) ·
              Năm học 2026–2027
            </p>
          </div>
          {report && (
            <div className="rounded-2xl bg-white/15 px-4 py-3 text-right backdrop-blur-sm">
              <div className="text-xs text-sky-50">Tự đánh giá Thông tư 94</div>
              <div className="text-xl font-extrabold text-amber-300">
                Mức độ {report.estimated_tt94_level}
              </div>
              <div className="text-[11px] text-sky-50">
                {report.total_periods_logged} tiết · {report.exams_meeting_10_pct} đề ≥ 10% EN
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "exam_builder", label: "Exam Builder (10% / 50%)", icon: FileSpreadsheet },
            { id: "resources", label: "Kho Giáo án & Slide CLIL", icon: BookOpenCheck },
            { id: "classrooms", label: "Lớp học & Bảng điểm", icon: Users },
            { id: "tt94_report", label: "Báo cáo Thông tư 94/2026", icon: BarChart3 },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                playClickSound();
                setTab(item.id);
              }}
              className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                active
                  ? "text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-sky-50"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="teacher-subtab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 shadow-sm"
                />
              )}
              <Icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* TAB 1: EXAM BUILDER */}
      {tab === "exam_builder" && (
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Thiết lập Ma trận Đề thi</h2>
              <button
                type="button"
                onClick={() => setShowAddQuestion((p) => !p)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm câu hỏi
              </button>
            </div>

            {showAddQuestion && (
              <form
                onSubmit={(e) => void handleCreateCustomQuestion(e)}
                className="space-y-2.5 rounded-xl border border-teal-200 bg-teal-50/40 p-3.5 text-xs"
              >
                <div className="font-bold text-teal-900">Thêm câu hỏi vào Ngân hàng trường</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    max={studioMaxLessons}
                    value={qLessonNo}
                    onChange={(e) => setQLessonNo(Number(e.target.value))}
                    placeholder={`Số bài (1-${studioMaxLessons})`}
                    className="rounded border border-slate-300 bg-white px-2 py-1.5"
                  />
                  <select
                    value={qLang}
                    onChange={(e) => setQLang(e.target.value as "vi" | "en")}
                    className="rounded border border-slate-300 bg-white px-2 py-1.5"
                  >
                    <option value="en">Tiếng Anh (EN)</option>
                    <option value="vi">Tiếng Việt (VI)</option>
                  </select>
                </div>
                <textarea
                  required
                  rows={2}
                  value={qPrompt}
                  onChange={(e) => setQPrompt(e.target.value)}
                  placeholder="Nội dung câu hỏi..."
                  className="w-full rounded border border-slate-300 bg-white p-2"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input required value={qOpt0} onChange={(e) => setQOpt0(e.target.value)} placeholder="Đáp án A" className="rounded border border-slate-300 bg-white px-2 py-1" />
                  <input required value={qOpt1} onChange={(e) => setQOpt1(e.target.value)} placeholder="Đáp án B" className="rounded border border-slate-300 bg-white px-2 py-1" />
                  <input required value={qOpt2} onChange={(e) => setQOpt2(e.target.value)} placeholder="Đáp án C" className="rounded border border-slate-300 bg-white px-2 py-1" />
                  <input required value={qOpt3} onChange={(e) => setQOpt3(e.target.value)} placeholder="Đáp án D" className="rounded border border-slate-300 bg-white px-2 py-1" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={qCorrectIdx}
                    onChange={(e) => setQCorrectIdx(Number(e.target.value))}
                    className="rounded border border-slate-300 bg-white px-2 py-1"
                  >
                    <option value={0}>Đúng: A</option>
                    <option value={1}>Đúng: B</option>
                    <option value={2}>Đúng: C</option>
                    <option value={3}>Đúng: D</option>
                  </select>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-teal-700 px-3 py-1.5 font-bold text-white"
                  >
                    Lưu câu hỏi
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Tên đề thi</label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Khối lớp đề thi (KHTN 6–9)
                </label>
                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  {VALID_GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        playClickSound();
                        applyStudioGrade(g);
                      }}
                      className={`rounded-lg border py-1.5 font-bold transition ${
                        studioGrade === g
                          ? "border-teal-600 bg-teal-50 text-teal-900"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Khối {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Nguồn học liệu sinh đề
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[
                    { id: "kntt", label: `SGK ${studioMaxLessons} bài` },
                    { id: "study_pack", label: "Bộ Đề 16 Units" },
                    { id: "both", label: "Kết hợp" },
                  ].map((src) => (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => setExamSourceMode(src.id as "kntt" | "study_pack" | "both")}
                      className={`rounded-lg border py-1.5 font-bold transition ${
                        examSourceMode === src.id
                          ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {src.label}
                    </button>
                  ))}
                </div>
              </div>

              {examSourceMode !== "study_pack" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Các bài học SGK KNTT {studioGrade} (1–{studioMaxLessons}, cách nhau dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={lessonRangeText}
                    onChange={(e) => setLessonRangeText(e.target.value)}
                    placeholder="vd: 8, 9, 10, 13, 18"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              {examSourceMode !== "kntt" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Chuyên đề Bộ Đề 16 Units (1–16, cách nhau dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={studyPackRangeText}
                    onChange={(e) => setStudyPackRangeText(e.target.value)}
                    placeholder="vd: 1, 7, 14"
                    className="w-full rounded-lg border border-indigo-200 bg-indigo-50/30 px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Preset Tỷ trọng Điểm Tiếng Anh (Thông tư 94/2026)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 0.0, label: "0% EN" },
                    { val: 0.1, label: "10% (1đ)" },
                    { val: 0.5, label: "50% (5đ)" },
                    { val: 1.0, label: "100% EN" },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setTargetRatio(preset.val)}
                      className={`rounded-lg border py-2 text-xs font-bold ${
                        targetRatio === preset.val
                          ? "border-teal-600 bg-teal-50 text-teal-900"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Số câu hỏi</label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value={10}>10 câu (1đ/câu)</option>
                    <option value={20}>20 câu (0.5đ/câu)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Thời gian</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value={15}>15 phút</option>
                    <option value={45}>45 phút</option>
                    <option value={60}>60 phút</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleGenerateExam()}
                className="w-full rounded-xl bg-teal-700 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {busy ? "Đang tạo đề..." : "Sinh Đề Kiểm Tra Chuẩn Thông Tư 94"}
              </button>
            </div>

            {examHistory.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <div className="mb-2 text-xs font-bold uppercase text-slate-400">
                  Đề đã tạo gần đây ({examHistory.length})
                </div>
                <div className="max-h-48 space-y-1.5 overflow-y-auto">
                  {examHistory.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => void api.getExamDetail(ex.id).then(setGeneratedExam)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs hover:bg-slate-50"
                    >
                      <span className="font-semibold text-slate-800">
                        <span className="mr-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">
                          K{ex.grade ?? 8}
                        </span>
                        {ex.title}
                      </span>
                      <span className="shrink-0 rounded bg-teal-50 px-2 py-0.5 font-bold text-teal-800">
                        {Math.round(ex.achieved_en_ratio * 100)}% EN
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Exam Preview & Word/PDF Export */}
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
            {generatedExam ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{generatedExam.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded bg-indigo-50 px-2 py-0.5 font-bold text-indigo-800">
                        Khối {generatedExam.grade ?? studioGrade}
                      </span>
                      <span>{generatedExam.duration_minutes} phút</span>
                      <span>·</span>
                      <span>
                        Tiếng Việt: <strong>{generatedExam.vi_points}đ</strong>
                      </span>
                      <span>·</span>
                      <span className="font-bold text-teal-800">
                        Tiếng Anh: {generatedExam.en_points}đ (
                        {Math.round(generatedExam.achieved_en_ratio * 100)}%)
                      </span>
                      {generatedExam.meets_tt94_50 ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-900">
                          Đạt Mức 50% TT94
                        </span>
                      ) : generatedExam.meets_tt94_10 ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-900">
                          Đạt Mức 10% TT94
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void api.downloadExamFile(generatedExam.id, "docx")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Xuất Word (.docx)
                    </button>
                    <button
                      type="button"
                      onClick={() => void api.downloadExamFile(generatedExam.id, "pdf")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-900 hover:bg-rose-100"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Xuất PDF (.pdf)
                    </button>
                  </div>
                </div>

                {classrooms.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                    <span className="font-semibold text-slate-700">Giao đề trực tuyến cho lớp:</span>
                    <select
                      value={assignClassroomId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setAssignClassroomId(nextId);
                        const cls = classrooms.find((c) => c.id === nextId);
                        if (cls) {
                          applyStudioGrade(normalizeGrade(cls.grade));
                        }
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium"
                    >
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Khối {c.grade} · {c.join_code})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleAssignGeneratedExam()}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 font-bold text-white hover:bg-teal-800"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Giao bài ngay
                    </button>
                  </div>
                )}

                <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
                  {generatedExam.questions.map((q) => (
                    <div
                      key={q.question_id}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`rounded px-2 py-0.5 font-bold uppercase ${
                            q.language === "en"
                              ? "bg-teal-100 text-teal-900"
                              : "bg-slate-200 text-slate-800"
                          }`}
                        >
                          Câu {q.order_no} · {q.language.toUpperCase()} · Bài {q.lesson_no}
                        </span>
                        <span className="font-semibold text-slate-600">{q.points} điểm</span>
                      </div>
                      <p className="mt-2 font-semibold text-slate-900">{q.prompt_text}</p>
                      <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                        {q.options.map((opt, i) => (
                          <div
                            key={`${q.question_id}-${i}`}
                            className={`rounded border px-2.5 py-1.5 ${
                              opt === q.correct_answer
                                ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-900"
                                : "border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            {["A", "B", "C", "D"][i]}. {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-sm text-slate-500">
                Chọn phạm vi bài học và preset <strong>10%</strong> hoặc <strong>50%</strong> rồi bấm{" "}
                <strong>Sinh Đề Kiểm Tra</strong> để xem trước và xuất Word/PDF.
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: CLIL RESOURCES */}
      {tab === "resources" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              {VALID_GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    playClickSound();
                    applyStudioGrade(g);
                  }}
                  className={`rounded-lg border py-1.5 font-bold transition ${
                    studioGrade === g
                      ? "border-teal-600 bg-teal-50 text-teal-900"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  K{g}
                </button>
              ))}
            </div>
            <label className="block text-xs font-bold uppercase text-slate-500">
              Chọn Bài học KHTN {studioGrade} (KNTT)
            </label>
            <select
              value={resourceLesson}
              onChange={(e) => setResourceLesson(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
            >
              {Array.from({ length: studioMaxLessons }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Bài {n}
                </option>
              ))}
            </select>

            <div className="space-y-2 pt-2">
              {resources.map((res) => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => setSelectedResource(res)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedResource?.id === res.id
                      ? "border-teal-600 bg-teal-50/70"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-xs font-bold uppercase text-teal-700">
                    {res.resource_type} · {res.clil_mode}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{res.title}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            {selectedResource ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-bold text-slate-900">{selectedResource.title}</h2>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(selectedResource.content_markdown);
                        setStatusMsg("Đã sao chép nội dung giáo án/slide Markdown.");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadResourceMd(selectedResource)}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Tải .md
                    </button>
                  </div>
                </div>
                <pre className="max-h-[540px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-800">
                  {selectedResource.content_markdown}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Chọn một học liệu CLIL bên trái.</p>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: CLASSROOMS & ANALYTICS */}
      {tab === "classrooms" && (
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-bold text-slate-900">Danh sách Lớp học</h2>
            <form onSubmit={(e) => void handleCreateClassroom(e)} className="flex flex-wrap gap-2">
              <select
                value={newClassGrade}
                onChange={(e) => setNewClassGrade(normalizeGrade(Number(e.target.value)))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800"
              >
                {VALID_GRADES.map((g) => (
                  <option key={g} value={g}>
                    Khối {g}
                  </option>
                ))}
              </select>
              <input
                required
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Tên lớp (vd: 6A2, 9A1)"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
              >
                Tạo
              </button>
            </form>

            <div className="space-y-2.5">
              {classrooms.map((c) => {
                const isSelected = selectedClassroomId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => void loadClassroomDetails(c.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-100"
                        : "border-slate-200 hover:border-teal-500 hover:bg-teal-50/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{c.name}</span>
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-800">
                          Khối {c.grade}
                        </span>
                      </div>
                      <span className="formula-pill rounded bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-900">
                        {c.join_code}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span>{c.student_count} học sinh</span>
                      <span>{c.logged_periods} tiết song ngữ đã dạy</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-5 lg:col-span-3">
            {/* Formal TT 94 Analytics Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {analytics ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{analytics.classroom_name}</h3>
                      <p className="text-xs text-slate-500">
                        {analytics.student_count} học sinh · {analytics.submissions_count} bài đã nộp
                      </p>
                    </div>
                    <div className="flex gap-3 text-center text-xs">
                      <div className="rounded-lg bg-slate-100 px-3 py-1.5">
                        <div className="font-bold text-slate-900">{analytics.average_score}</div>
                        <div className="text-slate-500">Điểm TB</div>
                      </div>
                      <div className="rounded-lg bg-teal-50 px-3 py-1.5">
                        <div className="font-bold text-teal-900">{analytics.average_en_score}</div>
                        <div className="text-teal-700">TB phần EN</div>
                      </div>
                    </div>
                  </div>

                  {analytics.submissions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                            <th className="py-2">Học sinh</th>
                            <th className="py-2">Đề kiểm tra</th>
                            <th className="py-2">Điểm VI</th>
                            <th className="py-2">Điểm EN</th>
                            <th className="py-2">Tổng</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {analytics.submissions.map((s, idx) => (
                            <tr key={`${s.student_id}-${idx}`}>
                              <td className="py-2 font-medium text-slate-900">{s.student_name}</td>
                              <td className="py-2 text-xs text-slate-600">{s.assignment_title}</td>
                              <td className="py-2 text-xs">{s.vi_score}</td>
                              <td className="py-2 text-xs font-semibold text-teal-800">{s.en_score}</td>
                              <td className="py-2 font-bold text-slate-900">
                                {s.score}/{s.max_score}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Chưa có học sinh nộp bài kiểm tra định kỳ nào trong lớp này.
                    </p>
                  )}

                  {analytics.weak_questions.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="mb-2 text-xs font-bold uppercase text-amber-900">
                        Câu hỏi / Thuật ngữ học sinh sai nhiều nhất
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-800">
                        {analytics.weak_questions.map((wq) => (
                          <div key={wq.question_id} className="flex justify-between gap-2">
                            <span>{wq.prompt_text}</span>
                            <span className="shrink-0 font-bold text-rose-700">
                              Sai {wq.miss_count}/{wq.total_attempts}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-slate-500">
                  Chọn một lớp bên trái để xem bảng điểm (VI vs EN), bảng xếp hạng và giao thử thách.
                </div>
              )}
            </div>

            {/* Classroom Gamification Leaderboard Card */}
            {leaderboard && (
              <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
                <ClassroomLeaderboardPanel leaderboard={leaderboard} compact />
              </div>
            )}

            {/* Teacher 5-Minute Mini-Game Challenge Card */}
            {selectedClassroomId && (
              <div className="space-y-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/40 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                    <Gamepad2 className="h-5 w-5 text-indigo-600" />
                    Giao Thử Thách Mini-Game 5 phút cho Lớp
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
                    <Sparkles className="h-3 w-3" />
                    Tương tác Gamification
                  </span>
                </div>

                <form onSubmit={(e) => void handleCreateGameChallenge(e)} className="space-y-3 text-sm">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600">
                      Tên thử thách gửi học sinh
                    </label>
                    <input
                      required
                      value={challengeTitle}
                      onChange={(e) => setChallengeTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-600">
                        Trò chơi KHTN
                      </label>
                      <select
                        value={challengeGameType}
                        onChange={(e) => setChallengeGameType(e.target.value as GameType)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                      >
                        <option value="lightning_match">Chớp Nhoáng Nối Cặp 60s</option>
                        <option value="iupac_lab">Phòng Pha Chế IUPAC</option>
                        <option value="sequence_lab">Tháp Sắp Xếp Quy Trình</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-600">
                        Chuyên đề Unit (1–16)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={16}
                        disabled={challengeGameType !== "lightning_match"}
                        value={challengeUnitNo}
                        onChange={(e) => setChallengeUnitNo(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-600">
                        Mục tiêu điểm
                      </label>
                      <input
                        type="number"
                        min={20}
                        max={2000}
                        step={10}
                        value={challengeTargetScore}
                        onChange={(e) => setChallengeTargetScore(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600">
                      Lời nhắn của giáo viên
                    </label>
                    <input
                      value={challengeNotes}
                      onChange={(e) => setChallengeNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={busy}
                      className="btn-tactile inline-flex items-center gap-2 rounded-xl border-indigo-900 bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2 text-xs font-extrabold text-white shadow disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Giao Thử Thách cho Lớp
                    </button>
                  </div>
                </form>

                {challenges.length > 0 && (
                  <div className="space-y-2 border-t border-indigo-100 pt-3">
                    <div className="text-xs font-extrabold uppercase text-slate-500">
                      Thử thách đang mở ({challenges.length})
                    </div>
                    {challenges.map((ch) => (
                      <div
                        key={ch.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{ch.title}</div>
                          <div className="text-slate-500">
                            {ch.game_type === "lightning_match"
                              ? `Nối Cặp 60s · Unit ${ch.unit_no ?? 1}`
                              : ch.game_type === "iupac_lab"
                                ? "Phòng Pha Chế IUPAC"
                                : "Tháp Sắp Xếp"}{" "}
                            · Mục tiêu {ch.target_score}đ · {ch.duration_minutes} phút
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                          Đã gửi lớp
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 4: TT94 COMPLIANCE REPORT & TEACHING LOGS */}
      {tab === "tt94_report" && (
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ClipboardList className="h-5 w-5 text-teal-700" />
              Ghi nhận Tiết dạy Song ngữ
            </h2>

            <form onSubmit={(e) => void handleLogSession(e)} className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Lớp học</label>
                <select
                  required
                  value={logClassroomId}
                  onChange={(e) => setLogClassroomId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Khối {c.grade})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Bài học KHTN {logGrade} (1–{logMaxLessons})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={logMaxLessons}
                    value={logLessonNo}
                    onChange={(e) => setLogLessonNo(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày dạy</label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Số tiết</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={logPeriods}
                    onChange={(e) => setLogPeriods(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Phút EN</label>
                  <input
                    type="number"
                    min={3}
                    max={225}
                    value={logMinutes}
                    onChange={(e) => setLogMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Chế độ</label>
                  <select
                    value={logMode}
                    onChange={(e) => setLogMode(e.target.value as ClilMode)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
                  >
                    <option value="term_only">Thuật ngữ</option>
                    <option value="bilingual_10">Song ngữ 10%</option>
                    <option value="bilingual_50">Song ngữ 50%</option>
                    <option value="full_english">100% EN</option>
                  </select>
                </div>
              </div>

              <input
                type="text"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="Ghi chú nội dung thuật ngữ đã dạy..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />

              <button
                type="submit"
                disabled={busy || !logClassroomId}
                className="w-full rounded-xl bg-teal-700 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                Lưu Nhật ký Minh chứng
              </button>
            </form>

            {sessions.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <div className="mb-2 text-xs font-bold uppercase text-slate-400">
                  Nhật ký gần đây ({sessions.length})
                </div>
                <div className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
                  {sessions.map((s) => {
                    const clsGrade = classrooms.find((c) => c.id === s.classroom_id)?.grade;
                    return (
                      <div key={s.id} className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="flex justify-between font-semibold text-slate-800">
                          <span>
                            {clsGrade ? `[K${clsGrade}] ` : ""}Bài {s.lesson_no} · {s.periods_count}{" "}
                            tiết ({s.clil_mode})
                          </span>
                          <span>{s.taught_date}</span>
                        </div>
                        {s.notes && <p className="mt-0.5 text-slate-600">{s.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3">
            {report && (
              <>
                <div>
                  <div className="text-xs font-bold uppercase text-teal-700">
                    Dashboard Tự Đánh giá Phụ lục II (Thông tư 94/2026/TT-BGDĐT)
                  </div>
                  <h3 className="mt-1 text-xl font-extrabold text-slate-900">
                    {report.level_label}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <div className="text-xl font-extrabold text-slate-900">
                      {report.classrooms_meeting_35_periods}/{report.total_classrooms}
                    </div>
                    <div className="text-[11px] text-slate-500">Lớp đạt ≥ 35 tiết</div>
                  </div>
                  <div className="rounded-xl bg-teal-50 p-3 text-center">
                    <div className="text-xl font-extrabold text-teal-900">
                      {report.total_periods_logged}
                    </div>
                    <div className="text-[11px] text-teal-700">Tổng tiết (Mục tiêu 105)</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 text-center">
                    <div className="text-xl font-extrabold text-amber-900">
                      {report.exams_meeting_10_pct}
                    </div>
                    <div className="text-[11px] text-amber-800">Đề đạt ≥ 10% EN</div>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 text-center">
                    <div className="text-xl font-extrabold text-emerald-900">
                      {report.exams_meeting_50_pct}
                    </div>
                    <div className="text-[11px] text-emerald-800">Đề đạt ≥ 50% EN</div>
                  </div>
                </div>

                {report.grade_breakdown && report.grade_breakdown.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold uppercase text-slate-500">
                      Phân rã Phủ sóng Toàn cấp THCS (Khối 6 · 7 · 8 · 9)
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Khối</th>
                            <th className="px-3 py-2">Số lớp</th>
                            <th className="px-3 py-2">Học sinh</th>
                            <th className="px-3 py-2">Tiết song ngữ</th>
                            <th className="px-3 py-2">Đề ≥ 10% EN</th>
                            <th className="px-3 py-2">Đề ≥ 50% EN</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.grade_breakdown.map((row) => (
                            <tr key={row.grade} className="hover:bg-sky-50/40">
                              <td className="px-3 py-2 font-extrabold text-indigo-800">
                                Khối {row.grade}
                              </td>
                              <td className="px-3 py-2 font-semibold text-slate-800">
                                {row.classrooms_count}
                              </td>
                              <td className="px-3 py-2 text-slate-700">{row.students_count}</td>
                              <td className="px-3 py-2 font-semibold text-teal-800">
                                {row.periods_logged} tiết ({row.english_minutes}p)
                              </td>
                              <td className="px-3 py-2 font-bold text-amber-700">
                                {row.exams_meeting_10_pct}/{row.exams_count}
                              </td>
                              <td className="px-3 py-2 font-bold text-emerald-700">
                                {row.exams_meeting_50_pct}/{row.exams_count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {report.next_level_gaps.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <div className="mb-1.5 text-xs font-bold uppercase text-amber-900">
                      Khuyến nghị để nâng mức đánh giá tiếp theo
                    </div>
                    <ul className="list-disc space-y-1 pl-4 text-xs text-amber-950">
                      {report.next_level_gaps.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase text-slate-400">
                    Tiến độ từng lớp học
                  </div>
                  {report.classrooms.map((cm) => {
                    const pct35 = Math.min(100, Math.round((cm.total_periods_logged / 35) * 100));
                    return (
                      <div key={cm.classroom_id} className="rounded-xl border border-slate-200 p-3.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-900">{cm.classroom_name}</span>
                          <span className="text-xs font-semibold text-teal-800">
                            {cm.total_periods_logged} / 35 tiết ({cm.total_english_minutes} phút EN)
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-teal-600" style={{ width: `${pct35}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
