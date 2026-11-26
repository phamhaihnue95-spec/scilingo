import type {
  AssignmentItem,
  AssignmentTake,
  AuthSession,
  Classroom,
  ClassroomAnalytics,
  ClassroomGameChallenge,
  ClassroomLeaderboard,
  ClilGenerateResult,
  ClilMode,
  CmsAuditLog,
  CmsCsvImportResult,
  CmsLessonList,
  CmsLessonUpdateResponse,
  CmsOverview,
  CmsQuestionCsvImportOut,
  CmsQuestionItem,
  CmsQuestionList,
  CmsResourceItem,
  CmsResourceList,
  CmsStudyPackList,
  CmsStudyPackMutationOut,
  CmsTenantDetail,
  CmsTermList,
  CmsTermMutationOut,
  CmsTrafficAnalytics,
  CmsTrafficPruneOut,
  CopilotLintResult,
  CopilotStatus,
  CurriculumTreeResponse,
  Discipline,
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
  LintCheckResult,
  PetHabitat,
  PetSpecies,
  PetTreatType,
  PracticeMode,
  PracticeResult,
  PracticeSession,
  PronunciationEvalResult,
  QuestionBankItem,
  SRSDueResponse,
  SRSReviewResult,
  StudentPetActionResult,
  StudentPetState,
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
  TutorAskResult,
  UserProfile,
} from "./types";

const API_ROOT = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const API_BASE = `${API_ROOT}/api/v1`;
const ACCESS_KEY = "scilingo_access_token";
const REFRESH_KEY = "scilingo_refresh_token";
const AUTH_NO_RETRY_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/analytics/track",
]);

export const AUTH_EXPIRED_EVENT = "scilingo:auth-expired";
export const API_COLD_START_EVENT = "scilingo:cold-start";

let slowRequestCount = 0;
let refreshPromise: Promise<string | null> | null = null;

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function saveAuthTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function emitColdStart(active: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(API_COLD_START_EVENT, { detail: { active } }));
}

function emitAuthExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithColdStartTracking(url: string, init: RequestInit): Promise<Response> {
  let markedSlow = false;
  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => {
          markedSlow = true;
          slowRequestCount += 1;
          if (slowRequestCount === 1) {
            emitColdStart(true);
          }
        }, 3500)
      : undefined;

  try {
    return await fetch(url, init);
  } finally {
    if (timer !== undefined) {
      window.clearTimeout(timer);
    }
    if (markedSlow) {
      slowRequestCount = Math.max(0, slowRequestCount - 1);
      if (slowRequestCount === 0) {
        emitColdStart(false);
      }
    }
  }
}

async function fetchWithColdStartAndRetry(url: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const canRetry = method === "GET";
  try {
    const res = await fetchWithColdStartTracking(url, init);
    if (canRetry && (res.status === 502 || res.status === 503 || res.status === 504)) {
      await sleep(1800);
      return await fetchWithColdStartTracking(url, init);
    }
    return res;
  } catch (err) {
    if (canRetry && err instanceof TypeError) {
      await sleep(1800);
      return await fetchWithColdStartTracking(url, init);
    }
    throw err;
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearAuthTokens();
    emitAuthExpired();
    return null;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetchWithColdStartTracking(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) {
        clearAuthTokens();
        emitAuthExpired();
        return null;
      }
      const data = (await res.json()) as AuthSession;
      saveAuthTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } catch {
      clearAuthTokens();
      emitAuthExpired();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function downloadCsvFile(path: string, filename: string): Promise<void> {
  const url = `${API_BASE}${path}`;
  let token = getStoredAccessToken();
  let res = await fetchWithColdStartAndRetry(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      token = refreshed;
      res = await fetchWithColdStartAndRetry(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }
  if (!res.ok) {
    throw new Error(`Không thể tải file CSV (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getStoredAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetchWithColdStartAndRetry(`${API_BASE}${path}`, { ...init, headers });
  const basePath = path.split("?")[0];
  if (res.status === 401 && !retried && token && !AUTH_NO_RETRY_PATHS.has(basePath)) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      const retryHeaders = new Headers(init.headers);
      retryHeaders.delete("Authorization");
      return request<T>(path, { ...init, headers: retryHeaders }, true);
    }
  }

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

  getMyPet(): Promise<StudentPetState> {
    return request<StudentPetState>("/learning/pet/me");
  },

  updateMyPet(payload: {
    species?: PetSpecies;
    nickname?: string;
    equipped_accessory?: string | null;
    clear_accessory?: boolean;
    equipped_habitat?: PetHabitat;
  }): Promise<StudentPetState> {
    return request<StudentPetState>("/learning/pet/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  feedMyPet(treat: PetTreatType): Promise<StudentPetActionResult> {
    return request<StudentPetActionResult>("/learning/pet/feed", {
      method: "POST",
      body: JSON.stringify({ treat }),
    });
  },

  petMyPet(): Promise<StudentPetActionResult> {
    return request<StudentPetActionResult>("/learning/pet/pet", {
      method: "POST",
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
    const url = `${API_BASE}/lms/exams/${encodeURIComponent(examId)}/export?format=${format}`;
    let token = getStoredAccessToken();
    let res = await fetchWithColdStartAndRetry(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401 && token) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        token = refreshed;
        res = await fetchWithColdStartAndRetry(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
    if (!res.ok) {
      throw new Error(`Không thể xuất file ${format.toUpperCase()} (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `scilingo-exam-${examId.slice(0, 8)}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
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

  // --- CMS Portal API (Units 1, 3, 5) ---
  cmsGetOverview(): Promise<CmsOverview> {
    return request<CmsOverview>("/identity/cms/overview");
  },

  cmsListUsers(params?: {
    tenant_id?: string;
    role?: string;
    q?: string;
    is_active?: boolean;
  }): Promise<UserProfile[]> {
    const sp = new URLSearchParams();
    if (params?.tenant_id) sp.set("tenant_id", params.tenant_id);
    if (params?.role) sp.set("role", params.role);
    if (params?.q) sp.set("q", params.q);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const query = sp.toString();
    return request<UserProfile[]>(`/identity/cms/users${query ? `?${query}` : ""}`);
  },

  cmsCreateUser(payload: {
    email: string;
    password: string;
    full_name: string;
    role: string;
    grade_level?: GradeLevel | null;
    tenant_id?: string | null;
  }): Promise<UserProfile> {
    return request<UserProfile>("/identity/cms/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  cmsUpdateUser(
    userId: string,
    payload: {
      full_name?: string;
      role?: string;
      grade_level?: GradeLevel | null;
      is_active?: boolean;
      new_password?: string;
    }
  ): Promise<UserProfile> {
    return request<UserProfile>(`/identity/cms/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  cmsImportUsersCsv(csv_content: string, tenant_id?: string | null): Promise<CmsCsvImportResult> {
    return request<CmsCsvImportResult>("/identity/cms/users/import-csv", {
      method: "POST",
      body: JSON.stringify({ csv_content, tenant_id: tenant_id || null }),
    });
  },

  cmsListTenants(): Promise<CmsTenantDetail[]> {
    return request<CmsTenantDetail[]>("/identity/cms/tenants");
  },

  cmsCreateTenant(payload: {
    name: string;
    tenant_type?: "school" | "b2c_individual";
    province?: string | null;
    district?: string | null;
    target_tt94_level?: number | null;
    plan_code?: string;
    ai_monthly_quota?: number;
  }): Promise<CmsTenantDetail> {
    return request<CmsTenantDetail>("/identity/cms/tenants", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  cmsUpdateTenant(
    tenantId: string,
    payload: {
      name?: string;
      province?: string | null;
      district?: string | null;
      target_tt94_level?: number | null;
      plan_code?: string;
      ai_monthly_quota?: number;
      subscription_status?: string;
    }
  ): Promise<CmsTenantDetail> {
    return request<CmsTenantDetail>(`/identity/cms/tenants/${encodeURIComponent(tenantId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  cmsListAuditLogs(params?: {
    module?: string;
    entity_type?: string;
    limit?: number;
  }): Promise<CmsAuditLog[]> {
    const sp = new URLSearchParams();
    if (params?.module) sp.set("module", params.module);
    if (params?.entity_type) sp.set("entity_type", params.entity_type);
    if (params?.limit) sp.set("limit", String(params.limit));
    const query = sp.toString();
    return request<CmsAuditLog[]>(`/identity/cms/audit-logs${query ? `?${query}` : ""}`);
  },

  cmsLintCheck(text: string, discipline?: string | null): Promise<LintCheckResult> {
    return request<LintCheckResult>("/curriculum/cms/lint-check", {
      method: "POST",
      body: JSON.stringify({ text, discipline: discipline || null }),
    });
  },

  cmsListLessons(params?: {
    grade?: GradeLevel;
    discipline?: string;
    q?: string;
  }): Promise<CmsLessonList> {
    const sp = new URLSearchParams();
    if (params?.grade) sp.set("grade", String(params.grade));
    if (params?.discipline) sp.set("discipline", params.discipline);
    if (params?.q) sp.set("q", params.q);
    const query = sp.toString();
    return request<CmsLessonList>(`/curriculum/cms/lessons${query ? `?${query}` : ""}`);
  },

  cmsUpdateLesson(
    lessonId: string,
    payload: {
      title_vi?: string;
      title_en?: string;
      discipline?: Discipline;
      is_practical?: boolean;
      summary_vi?: string;
      summary_en?: string;
      strict_lint?: boolean;
    }
  ): Promise<CmsLessonUpdateResponse> {
    return request<CmsLessonUpdateResponse>(
      `/curriculum/cms/lessons/${encodeURIComponent(lessonId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
  },

  cmsListTerms(params?: {
    q?: string;
    discipline?: string;
    status_filter?: "all" | "verified" | "draft";
    grade?: GradeLevel;
    limit?: number;
    offset?: number;
  }): Promise<CmsTermList> {
    const sp = new URLSearchParams();
    if (params?.q) sp.set("q", params.q);
    if (params?.discipline) sp.set("discipline", params.discipline);
    if (params?.status_filter) sp.set("status_filter", params.status_filter);
    if (params?.grade) sp.set("grade", String(params.grade));
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.offset) sp.set("offset", String(params.offset));
    const query = sp.toString();
    return request<CmsTermList>(`/curriculum/cms/terms${query ? `?${query}` : ""}`);
  },

  cmsCreateTerm(payload: {
    term_en: string;
    term_vi: string;
    ipa?: string;
    discipline: Discipline;
    part_of_speech?: string;
    formula_or_symbol?: string;
    iupac_note?: string;
    definition_vi?: string;
    definition_en?: string;
    example_en?: string;
    example_vi?: string;
    status?: "draft" | "verified";
    lesson_ids?: string[];
  }): Promise<CmsTermMutationOut> {
    return request<CmsTermMutationOut>("/curriculum/cms/terms", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  cmsUpdateTerm(
    termId: string,
    payload: {
      term_en?: string;
      term_vi?: string;
      ipa?: string;
      discipline?: Discipline;
      part_of_speech?: string;
      formula_or_symbol?: string;
      iupac_note?: string;
      definition_vi?: string;
      definition_en?: string;
      example_en?: string;
      example_vi?: string;
      status?: "draft" | "verified";
      lesson_ids?: string[];
    }
  ): Promise<CmsTermMutationOut> {
    return request<CmsTermMutationOut>(`/curriculum/cms/terms/${encodeURIComponent(termId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  cmsDeleteTerm(termId: string): Promise<{ deleted_id: string }> {
    return request<{ deleted_id: string }>(`/curriculum/cms/terms/${encodeURIComponent(termId)}`, {
      method: "DELETE",
    });
  },

  cmsListQuestions(params?: {
    grade?: GradeLevel;
    lesson_no?: number;
    language?: "vi" | "en";
    cognitive_level?: "know" | "understand" | "apply";
    linter_verified?: boolean;
    scope?: "all" | "official" | "tenant";
    q?: string;
    limit?: number;
  }): Promise<CmsQuestionList> {
    const sp = new URLSearchParams();
    if (params?.grade) sp.set("grade", String(params.grade));
    if (params?.lesson_no) sp.set("lesson_no", String(params.lesson_no));
    if (params?.language) sp.set("language", params.language);
    if (params?.cognitive_level) sp.set("cognitive_level", params.cognitive_level);
    if (params?.linter_verified !== undefined) {
      sp.set("linter_verified", String(params.linter_verified));
    }
    if (params?.scope) sp.set("scope", params.scope);
    if (params?.q) sp.set("q", params.q);
    if (params?.limit) sp.set("limit", String(params.limit));
    const query = sp.toString();
    return request<CmsQuestionList>(`/lms/cms/questions${query ? `?${query}` : ""}`);
  },

  cmsCreateQuestion(payload: {
    grade: GradeLevel;
    lesson_no: number;
    language: "vi" | "en";
    cognitive_level: "know" | "understand" | "apply";
    discipline: string;
    prompt_text: string;
    options: string[];
    correct_index: number;
    explanation_vi: string;
    is_official?: boolean;
  }): Promise<CmsQuestionItem> {
    return request<CmsQuestionItem>("/lms/cms/questions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  cmsUpdateQuestion(
    questionId: string,
    payload: {
      grade?: GradeLevel;
      lesson_no?: number;
      language?: "vi" | "en";
      cognitive_level?: "know" | "understand" | "apply";
      discipline?: string;
      prompt_text?: string;
      options?: string[];
      correct_index?: number;
      explanation_vi?: string;
      is_official?: boolean;
    }
  ): Promise<CmsQuestionItem> {
    return request<CmsQuestionItem>(`/lms/cms/questions/${encodeURIComponent(questionId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  cmsDeleteQuestion(questionId: string): Promise<{ deleted_id: string }> {
    return request<{ deleted_id: string }>(
      `/lms/cms/questions/${encodeURIComponent(questionId)}`,
      { method: "DELETE" }
    );
  },

  cmsImportQuestionsCsv(
    csv_content: string,
    is_official = false
  ): Promise<CmsQuestionCsvImportOut> {
    return request<CmsQuestionCsvImportOut>("/lms/cms/questions/import-csv", {
      method: "POST",
      body: JSON.stringify({ csv_content, is_official }),
    });
  },

  cmsListResources(params?: {
    grade?: GradeLevel;
    lesson_no?: number;
    resource_type?: string;
    clil_mode?: ClilMode;
    scope?: "all" | "official" | "tenant";
    q?: string;
    limit?: number;
  }): Promise<CmsResourceList> {
    const sp = new URLSearchParams();
    if (params?.grade) sp.set("grade", String(params.grade));
    if (params?.lesson_no) sp.set("lesson_no", String(params.lesson_no));
    if (params?.resource_type) sp.set("resource_type", params.resource_type);
    if (params?.clil_mode) sp.set("clil_mode", params.clil_mode);
    if (params?.scope) sp.set("scope", params.scope);
    if (params?.q) sp.set("q", params.q);
    if (params?.limit) sp.set("limit", String(params.limit));
    const query = sp.toString();
    return request<CmsResourceList>(`/lms/cms/resources${query ? `?${query}` : ""}`);
  },

  cmsCreateResource(payload: {
    grade: GradeLevel;
    lesson_no: number;
    title: string;
    resource_type: "lesson_plan" | "bilingual_slide" | "worksheet" | "glossary_card";
    clil_mode: ClilMode;
    content_markdown: string;
    is_official?: boolean;
  }): Promise<CmsResourceItem> {
    return request<CmsResourceItem>("/lms/cms/resources", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  cmsUpdateResource(
    resourceId: string,
    payload: {
      grade?: GradeLevel;
      lesson_no?: number;
      title?: string;
      resource_type?: "lesson_plan" | "bilingual_slide" | "worksheet" | "glossary_card";
      clil_mode?: ClilMode;
      content_markdown?: string;
      is_official?: boolean;
    }
  ): Promise<CmsResourceItem> {
    return request<CmsResourceItem>(`/lms/cms/resources/${encodeURIComponent(resourceId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  cmsDeleteResource(resourceId: string): Promise<{ deleted_id: string }> {
    return request<{ deleted_id: string }>(
      `/lms/cms/resources/${encodeURIComponent(resourceId)}`,
      { method: "DELETE" }
    );
  },

  cmsDeleteUser(userId: string): Promise<{ deleted_id: string; email: string }> {
    return request<{ deleted_id: string; email: string }>(
      `/identity/cms/users/${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    );
  },

  trackAccessEvent(payload: {
    visitor_id: string;
    event_type: "page_view" | "lesson_view" | "game_play" | "cms_view";
    path: string;
    grade?: GradeLevel;
    device_type: "mobile" | "tablet" | "desktop";
    referrer?: string | null;
  }): Promise<{ status: string; id: string }> {
    return request<{ status: string; id: string }>("/analytics/track", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  cmsGetTraffic(days = 14): Promise<CmsTrafficAnalytics> {
    return request<CmsTrafficAnalytics>(`/identity/cms/traffic?days=${days}`);
  },

  cmsPruneTraffic(retentionDays = 90): Promise<CmsTrafficPruneOut> {
    return request<CmsTrafficPruneOut>("/identity/cms/traffic/prune", {
      method: "POST",
      body: JSON.stringify({ retention_days: retentionDays }),
    });
  },

  cmsDownloadUsersCsv(params?: {
    tenant_id?: string;
    role?: string;
    q?: string;
    is_active?: boolean;
  }): Promise<void> {
    const sp = new URLSearchParams();
    if (params?.tenant_id) sp.set("tenant_id", params.tenant_id);
    if (params?.role) sp.set("role", params.role);
    if (params?.q) sp.set("q", params.q);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return downloadCsvFile(
      `/identity/cms/users/export-csv${qs ? `?${qs}` : ""}`,
      "scilingo-users.csv"
    );
  },

  cmsDownloadTrafficCsv(days = 14): Promise<void> {
    return downloadCsvFile(
      `/identity/cms/traffic/export-csv?days=${days}`,
      `scilingo-traffic-${days}d.csv`
    );
  },

  downloadTT94ReportCsv(academicYear = "2026-2027"): Promise<void> {
    return downloadCsvFile(
      `/lms/reports/tt94-compliance/export-csv?academic_year=${encodeURIComponent(academicYear)}`,
      `scilingo-tt94-${academicYear}.csv`
    );
  },

  cmsListStudyPackItems(params?: {
    unit_no?: number;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<CmsStudyPackList> {
    const sp = new URLSearchParams();
    if (params?.unit_no) sp.set("unit_no", String(params.unit_no));
    if (params?.q) sp.set("q", params.q);
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.offset) sp.set("offset", String(params.offset));
    const qs = sp.toString();
    return request<CmsStudyPackList>(`/curriculum/cms/study-pack/items${qs ? `?${qs}` : ""}`);
  },

  cmsCreateStudyPackItem(payload: {
    unit_no: number;
    order_no?: number | null;
    term_en: string;
    ipa?: string;
    pos?: string;
    meaning_vi: string;
    iupac_note?: string | null;
  }): Promise<CmsStudyPackMutationOut> {
    return request<CmsStudyPackMutationOut>("/curriculum/cms/study-pack/items", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  cmsUpdateStudyPackItem(
    itemId: string,
    payload: {
      unit_no?: number;
      order_no?: number;
      term_en?: string;
      ipa?: string;
      pos?: string;
      meaning_vi?: string;
      iupac_note?: string | null;
    }
  ): Promise<CmsStudyPackMutationOut> {
    return request<CmsStudyPackMutationOut>(
      `/curriculum/cms/study-pack/items/${encodeURIComponent(itemId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
  },

  cmsDeleteStudyPackItem(itemId: string): Promise<{ deleted_id: string; term_en: string }> {
    return request<{ deleted_id: string; term_en: string }>(
      `/curriculum/cms/study-pack/items/${encodeURIComponent(itemId)}`,
      { method: "DELETE" }
    );
  },

  // --- Unit 4: AI Copilot API ---
  copilotGetStatus(): Promise<CopilotStatus> {
    return request<CopilotStatus>("/copilot/status");
  },

  copilotLintTerminology(text: string, discipline?: string | null): Promise<CopilotLintResult> {
    return request<CopilotLintResult>("/copilot/lint-terminology", {
      method: "POST",
      body: JSON.stringify({ text, discipline: discipline || null }),
    });
  },

  copilotAskTutor(payload: {
    grade: GradeLevel;
    lesson_no?: number | null;
    question: string;
    response_mode?: "bilingual" | "vi" | "en";
  }): Promise<TutorAskResult> {
    return request<TutorAskResult>("/copilot/tutor/ask", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  copilotGenerateClilQuestions(payload: {
    grade: GradeLevel;
    lesson_no: number;
    language: "en" | "vi" | "bilingual";
    cognitive_level: "know" | "understand" | "apply";
    count: number;
    focus_topic?: string | null;
  }): Promise<ClilGenerateResult> {
    return request<ClilGenerateResult>("/copilot/generate-clil-questions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  copilotEvaluatePronunciation(payload: {
    target_term: string;
    spoken_transcript: string;
    ipa?: string | null;
  }): Promise<PronunciationEvalResult> {
    return request<PronunciationEvalResult>("/copilot/pronunciation/evaluate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
