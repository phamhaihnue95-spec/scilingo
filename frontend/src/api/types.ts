export type Discipline = "general_lab" | "chemistry" | "physics" | "biology";

export interface LessonSummary {
  id: string;
  lesson_no: number;
  title_vi: string;
  title_en: string;
  discipline: Discipline;
  is_practical: boolean;
  term_count: number;
  integration_count: number;
}

export interface ChapterWithLessons {
  id: string;
  grade: number;
  textbook_series: string;
  chapter_no: number;
  code: string;
  title_vi: string;
  title_en: string;
  discipline: Discipline;
  lessons: LessonSummary[];
}

export interface CurriculumTreeResponse {
  grade: number;
  textbook_series: string;
  total_chapters: number;
  total_lessons: number;
  chapters: ChapterWithLessons[];
}

export interface TermSummary {
  id: string;
  slug: string;
  term_en: string;
  term_vi: string;
  ipa: string | null;
  audio_url: string | null;
  discipline: Discipline;
  formula_or_symbol: string | null;
  iupac_note: string | null;
  is_13_exception_element: boolean;
  status: string;
}

export interface LinkedLessonRef {
  lesson_no: number;
  title_vi: string;
  title_en: string;
  discipline: Discipline;
}

export interface TermDetail extends TermSummary {
  part_of_speech: string | null;
  definition_vi: string | null;
  definition_en: string | null;
  example_en: string | null;
  example_vi: string | null;
  lessons: LinkedLessonRef[];
}

export interface IntegrationLink {
  target_lesson_no: number;
  target_title_vi: string;
  target_title_en: string;
  target_discipline: Discipline;
  note_vi: string;
}

export interface LessonDetail {
  id: string;
  lesson_no: number;
  title_vi: string;
  title_en: string;
  discipline: Discipline;
  is_practical: boolean;
  chapter_no: number;
  chapter_title_vi: string;
  chapter_title_en: string;
  summary_vi: string | null;
  summary_en: string | null;
  integration_links: IntegrationLink[];
  terms: TermSummary[];
}

export interface TermSearchResponse {
  total: number;
  items: TermSummary[];
}

export interface ExceptionElementRule {
  symbol: string;
  vi_elemental: string;
  iupac_en: string;
  allowed_elemental_contexts: string[];
  compound_example_iupac: string;
}

export interface DeprecatedTermRule {
  pattern: string;
  recommended: string;
  discipline: string;
  severity: string;
  reason: string;
}

export interface TerminologyRulebook {
  name: string;
  legal_basis: string[];
  exception_13_elements: ExceptionElementRule[];
  deprecated_terms_to_flag: DeprecatedTermRule[];
}

export interface TenantInfo {
  id: string;
  name: string;
  tenant_type: string;
  province: string | null;
  district: string | null;
  target_tt94_level: number | null;
}

export interface UserProfile {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: "student" | "teacher" | "school_admin" | "platform_admin";
  grade_level: number | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserProfile;
  tenant: TenantInfo;
}

export interface Entitlements {
  tenant: TenantInfo;
  plan_code: string;
  status: string;
  ai_monthly_quota: number;
  ai_used_this_month: number;
  ai_remaining: number;
  features: string[];
}

export type PracticeMode = "quiz_10" | "quiz_50" | "quiz_100";

export interface SRSDueCard {
  term_id: string;
  slug: string;
  term_en: string;
  term_vi: string;
  ipa: string | null;
  discipline: Discipline;
  formula_or_symbol: string | null;
  iupac_note: string | null;
  is_13_exception_element: boolean;
  is_new: boolean;
  repetitions: number;
  interval_days: number;
  ease_factor: number;
  next_review_at: string | null;
}

export interface SRSDueResponse {
  total_due: number;
  total_new: number;
  cards: SRSDueCard[];
}

export interface SRSReviewResult {
  term_id: string;
  repetitions: number;
  interval_days: number;
  ease_factor: number;
  next_review_at: string;
  xp_earned: number;
  total_xp: number;
  current_streak: number;
  newly_unlocked_badges: string[];
}

export interface MindmapNode {
  id: string;
  node_type: "lesson" | "term" | "integration";
  label_vi: string;
  label_en: string;
  discipline: Discipline;
  ipa: string | null;
  formula_or_symbol: string | null;
  note: string | null;
  target_lesson_no: number | null;
  is_13_exception_element: boolean;
}

export interface MindmapEdge {
  source: string;
  target: string;
  relation: "contains_term" | "cross_discipline";
  label_vi: string | null;
}

export interface LessonMindmap {
  lesson_no: number;
  title_vi: string;
  title_en: string;
  discipline: Discipline;
  nodes: MindmapNode[];
  edges: MindmapEdge[];
}

export interface QuizQuestionPublic {
  index: number;
  term_id: string;
  language: "vi" | "en";
  points: number;
  prompt: string;
  options: string[];
  discipline: Discipline;
}

export interface PracticeSession {
  attempt_id: string;
  lesson_no: number;
  lesson_title_vi: string;
  lesson_title_en: string;
  mode: PracticeMode;
  total_questions: number;
  english_questions_count: number;
  english_ratio: number;
  questions: QuizQuestionPublic[];
}

export interface QuestionFeedback {
  index: number;
  language: "vi" | "en";
  prompt: string;
  options: string[];
  selected_index: number | null;
  correct_index: number;
  is_correct: boolean;
  points_earned: number;
  max_points: number;
  term_en: string;
  term_vi: string;
  explanation_vi: string;
}

export interface PracticeResult {
  attempt_id: string;
  lesson_no: number;
  mode: PracticeMode;
  score: number;
  max_score: number;
  vi_score: number;
  en_score: number;
  english_ratio: number;
  xp_earned: number;
  total_xp: number;
  current_streak: number;
  newly_unlocked_badges: string[];
  feedback: QuestionFeedback[];
}

export interface PracticeHistoryItem {
  attempt_id: string;
  lesson_no: number;
  mode: string;
  score: number;
  english_ratio: number;
  completed_at: string;
}

export interface GamificationSummary {
  student_id: string;
  current_streak: number;
  longest_streak: number;
  total_xp: number;
  level: number;
  next_level_xp: number;
  cards_mastered: number;
  cards_in_review: number;
  badges: string[];
  discipline_xp: Record<string, number>;
  last_study_date: string | null;
  recent_attempts: PracticeHistoryItem[];
}
