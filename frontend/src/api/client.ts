import type {
  AuthSession,
  CurriculumTreeResponse,
  Entitlements,
  GamificationSummary,
  LessonDetail,
  LessonMindmap,
  PracticeMode,
  PracticeResult,
  PracticeSession,
  SRSDueResponse,
  SRSReviewResult,
  TermDetail,
  TermSearchResponse,
  TerminologyRulebook,
  UserProfile,
} from "./types";

const API_BASE = "/api/v1";
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
  getChapters(discipline?: string): Promise<CurriculumTreeResponse> {
    const query = discipline ? `?discipline=${encodeURIComponent(discipline)}` : "";
    return request<CurriculumTreeResponse>(`/curriculum/kntt-8/chapters${query}`);
  },

  getLesson(lessonNo: number): Promise<LessonDetail> {
    return request<LessonDetail>(`/curriculum/lessons/${lessonNo}`);
  },

  searchTerms(params: {
    q?: string;
    discipline?: string;
    lessonNo?: number;
    limit?: number;
  }): Promise<TermSearchResponse> {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.discipline) sp.set("discipline", params.discipline);
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

  getLessonMindmap(lessonNo: number): Promise<LessonMindmap> {
    return request<LessonMindmap>(`/learning/mindmap/${lessonNo}`);
  },

  getDueFlashcards(params: {
    lessonNo?: number;
    discipline?: string;
    limit?: number;
  }): Promise<SRSDueResponse> {
    const sp = new URLSearchParams();
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
};
