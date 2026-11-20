import type {
  AssignmentItem,
  AssignmentTake,
  AuthSession,
  Classroom,
  ClassroomAnalytics,
  ClassroomGameChallenge,
  ClassroomLeaderboard,
  ClilMode,
  CurriculumTreeResponse,
  Entitlements,
  ExamDetail,
  ExamSummary,
  GameChallengeCreatePayload,
  GameRewardPayload,
  GameRewardResult,
  GamificationSummary,
  GradeLevel,
  GradeOverview,
  LessonDetail,
  LessonMindmap,
  PracticeMode,
  PracticeResult,
  PracticeSession,
  QuestionBankItem,
  SRSDueResponse,
  SRSReviewResult,
  StudyPackOverview,
  StudyPackQuiz,
  StudyPackSearchResponse,
  StudyPackUnitDetail,
  SubmissionResult,
  TT94ComplianceReport,
  TeacherResource,
  TeachingSessionLog,
  TermDetail,
  TermSearchResponse,
  TerminologyRulebook,
  UserProfile,
} from "./types";

const API_ROOT = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const API_BASE = `${API_ROOT}/api/v1`;
const ACCESS_KEY = "scilingo_access_token";
const REFRESH_KEY = "scilingo_refresh_token";

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function saveAuthTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getStoredAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let message = `Lỗi HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { detail?: string };
      if (errBody.detail) message = errBody.detail;
    } catch {
      // ignore non-JSON errors
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const api = {
  getGrades(): Promise<GradeOverview[]> {
    return request<GradeOverview[]>("/curriculum/grades");
  },

  getChapters(discipline?: string, grade: GradeLevel = 8): Promise<CurriculumTreeResponse> {
    const query = discipline ? `?discipline=${encodeURIComponent(discipline)}` : "";
    return request<CurriculumTreeResponse>(`/curriculum/kntt/${grade}/chapters${query}`);
  },

  getLesson(lessonNo: number, grade: GradeLevel = 8): Promise<LessonDetail> {
    return request<LessonDetail>(`/curriculum/kntt/${grade}/lessons/${lessonNo}`);
  },

  searchTerms(params: {
    q?: string;
    discipline?: string;
    grade?: GradeLevel;
    lessonNo?: number;
    limit?: number;
  }): Promise<TermSearchResponse> {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.discipline) sp.set("discipline", params.discipline);
    if (params.grade) sp.set("grade", String(params.grade));
    if (params.lessonNo) sp.set("lesson_no", String(params.lessonNo));
    if (params.limit) sp.set("limit", String(params.limit));
    const qs = sp.toString();
    return request<TermSearchResponse>(`/terms${qs ? `?${qs}` : ""}`);
  },

  getTermDetail(slug: string): Promise<TermDetail> {
    return request<TermDetail>(`/terms/${encodeURIComponent(slug)}`);
  },

  getIupacRules(): Promise<TerminologyRulebook> {
    return request<TerminologyRulebook>("/curriculum/rules/iupac");
  },

  getStudyPackOverview(): Promise<StudyPackOverview> {
    return request<StudyPackOverview>("/study-packs/english-science");
  },

  getStudyPackUnit(unitNo: number): Promise<StudyPackUnitDetail> {
    return request<StudyPackUnitDetail>(`/study-packs/english-science/units/${unitNo}`);
  },

  searchStudyPack(params: {
    q?: string;
    unitNo?: number;
    limit?: number;
    offset?: number;
  }): Promise<StudyPackSearchResponse> {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.unitNo) sp.set("unit_no", String(params.unitNo));
    if (params.limit) sp.set("limit", String(params.limit));
    if (params.offset) sp.set("offset", String(params.offset));
    const qs = sp.toString();
    return request<StudyPackSearchResponse>(
      `/study-packs/english-science/search${qs ? `?${qs}` : ""}`
    );
  },

  generateStudyPackQuiz(payload: {
    unit_nos: number[];
    mode: PracticeMode;
    question_count: number;
  }): Promise<StudyPackQuiz> {
    return request<StudyPackQuiz>("/study-packs/english-science/quiz", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  register(payload: {
    email: string;
    password: string;
    full_name: string;
    role: "student" | "teacher";
    grade_level: number;
  }): Promise<AuthSession> {
    return request<AuthSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }): Promise<AuthSession> {
    return request<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getMe(): Promise<UserProfile> {
    return request<UserProfile>("/auth/me");
  },

  getEntitlements(): Promise<Entitlements> {
    return request<Entitlements>("/tenants/me/entitlements");
  },

  getTenantUsers(): Promise<UserProfile[]> {
    return request<UserProfile[]>("/tenants/me/users");
  },

  getLessonMindmap(lessonNo: number, grade: GradeLevel = 8): Promise<LessonMindmap> {
    return request<LessonMindmap>(`/learning/mindmap/${lessonNo}?grade=${grade}`);
  },

  getDueFlashcards(params: {
    grade?: GradeLevel;
    lessonNo?: number;
    discipline?: string;
    limit?: number;
  }): Promise<SRSDueResponse> {
    const sp = new URLSearchParams();
    if (params.grade) sp.set("grade", String(params.grade));
    if (params.lessonNo) sp.set("lesson_no", String(params.lessonNo));
    if (params.discipline) sp.set("discipline", params.discipline);
    if (params.limit) sp.set("limit", String(params.limit));
    const qs = sp.toString();
    return request<SRSDueResponse>(`/learning/srs/due${qs ? `?${qs}` : ""}`);
  },

  reviewFlashcard(payload: { term_id: string; quality: number }): Promise<SRSReviewResult> {
    return request<SRSReviewResult>("/learning/srs/review", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  startPractice(payload: {
    grade?: GradeLevel;
    lesson_no: number;
    mode: PracticeMode;
    total_questions?: number;
  }): Promise<PracticeSession> {
    return request<PracticeSession>("/learning/practice/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  submitPractice(
    attemptId: string,
    answers: Array<{ index: number; selected_index: number }>
  ): Promise<PracticeResult> {
    return request<PracticeResult>(`/learning/practice/${encodeURIComponent(attemptId)}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  },

  getGamification(): Promise<GamificationSummary> {
    return request<GamificationSummary>("/learning/gamification/me");
  },

  recordGameReward(payload: GameRewardPayload): Promise<GameRewardResult> {
    return request<GameRewardResult>("/learning/games/reward", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // --- Unit 3: Teacher Studio, LMS, Exam Builder & TT94 ---
  listClassrooms(): Promise<Classroom[]> {
    return request<Classroom[]>("/lms/classrooms");
  },

  createClassroom(payload: {
    name: string;
    grade: number;
    academic_year?: string;
    is_tt94_pilot_class?: boolean;
  }): Promise<Classroom> {
    return request<Classroom>("/lms/classrooms", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  joinClassroom(joinCode: string): Promise<Classroom> {
    return request<Classroom>("/lms/classrooms/join", {
      method: "POST",
      body: JSON.stringify({ join_code: joinCode }),
    });
  },

  getClassroomAnalytics(classroomId: string): Promise<ClassroomAnalytics> {
    return request<ClassroomAnalytics>(
      `/lms/classrooms/${encodeURIComponent(classroomId)}/analytics`
    );
  },

  listMyClassrooms(): Promise<Classroom[]> {
    return request<Classroom[]>("/lms/my-classrooms");
  },

  getClassroomLeaderboard(classroomId: string): Promise<ClassroomLeaderboard> {
    return request<ClassroomLeaderboard>(
      `/lms/classrooms/${encodeURIComponent(classroomId)}/leaderboard`
    );
  },

  createGameChallenge(
    classroomId: string,
    payload: GameChallengeCreatePayload
  ): Promise<ClassroomGameChallenge> {
    return request<ClassroomGameChallenge>(
      `/lms/classrooms/${encodeURIComponent(classroomId)}/game-challenges`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  listClassroomGameChallenges(classroomId: string): Promise<ClassroomGameChallenge[]> {
    return request<ClassroomGameChallenge[]>(
      `/lms/classrooms/${encodeURIComponent(classroomId)}/game-challenges`
    );
  },

  listMyGameChallenges(): Promise<ClassroomGameChallenge[]> {
    return request<ClassroomGameChallenge[]>("/lms/my-game-challenges");
  },

  getLessonResources(lessonNo: number, grade: GradeLevel = 8): Promise<TeacherResource[]> {
    return request<TeacherResource[]>(`/lms/resources?lesson_no=${lessonNo}&grade=${grade}`);
  },

  listQuestions(lessonNo?: number, grade?: GradeLevel): Promise<QuestionBankItem[]> {
    const sp = new URLSearchParams();
    if (grade) sp.set("grade", String(grade));
    if (lessonNo) sp.set("lesson_no", String(lessonNo));
    const query = sp.toString();
    return request<QuestionBankItem[]>(`/lms/questions${query ? `?${query}` : ""}`);
  },

  createQuestion(payload: {
    grade?: GradeLevel;
    lesson_no: number;
    language: "vi" | "en";
    cognitive_level: "know" | "understand" | "apply";
    discipline: string;
    prompt_text: string;
    options: string[];
    correct_index: number;
    explanation_vi: string;
  }): Promise<QuestionBankItem> {
    return request<QuestionBankItem>("/lms/questions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  generateExam(payload: {
    title: string;
    grade?: GradeLevel;
    lesson_nos?: number[];
    study_pack_unit_nos?: number[];
    classroom_id?: string | null;
    target_en_ratio: number;
    total_points: number;
    question_count: number;
    duration_minutes: number;
  }): Promise<ExamDetail> {
    return request<ExamDetail>("/lms/exams/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  listExams(): Promise<ExamSummary[]> {
    return request<ExamSummary[]>("/lms/exams");
  },

  getExamDetail(examId: string): Promise<ExamDetail> {
    return request<ExamDetail>(`/lms/exams/${encodeURIComponent(examId)}`);
  },

  async downloadExamFile(examId: string, format: "docx" | "pdf"): Promise<void> {
    const token = getStoredAccessToken();
    const res = await fetch(
      `${API_BASE}/lms/exams/${encodeURIComponent(examId)}/export?format=${format}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) {
      throw new Error(`Không thể xuất file ${format.toUpperCase()} (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `scilingo-exam-${examId.slice(0, 8)}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  assignExam(classroomId: string, examId: string, title?: string): Promise<AssignmentItem> {
    return request<AssignmentItem>(
      `/lms/classrooms/${encodeURIComponent(classroomId)}/assignments`,
      {
        method: "POST",
        body: JSON.stringify({ exam_id: examId, title }),
      }
    );
  },

  listMyAssignments(): Promise<AssignmentItem[]> {
    return request<AssignmentItem[]>("/lms/my-assignments");
  },

  takeAssignment(assignmentId: string): Promise<AssignmentTake> {
    return request<AssignmentTake>(
      `/lms/assignments/${encodeURIComponent(assignmentId)}/take`
    );
  },

  submitAssignment(
    assignmentId: string,
    answers: Array<{ question_id: string; selected_index: number }>
  ): Promise<SubmissionResult> {
    return request<SubmissionResult>(
      `/lms/assignments/${encodeURIComponent(assignmentId)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ answers }),
      }
    );
  },

  logTeachingSession(payload: {
    classroom_id: string;
    grade?: GradeLevel;
    lesson_no: number;
    taught_date: string;
    periods_count: number;
    clil_mode: ClilMode;
    english_minutes: number;
    notes?: string;
  }): Promise<TeachingSessionLog> {
    return request<TeachingSessionLog>("/lms/sessions/log", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  listTeachingSessions(classroomId?: string): Promise<TeachingSessionLog[]> {
    const query = classroomId ? `?classroom_id=${encodeURIComponent(classroomId)}` : "";
    return request<TeachingSessionLog[]>(`/lms/sessions${query}`);
  },

  getTT94ComplianceReport(academicYear = "2026-2027"): Promise<TT94ComplianceReport> {
    return request<TT94ComplianceReport>(
      `/lms/reports/tt94-compliance?academic_year=${encodeURIComponent(academicYear)}`
    );
  },
};
