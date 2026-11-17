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

export type ClilMode = "term_only" | "bilingual_10" | "bilingual_50" | "full_english";

export interface Classroom {
  id: string;
  tenant_id: string;
  teacher_id: string;
  name: string;
  grade: number;
  academic_year: string;
  join_code: string;
  is_tt94_pilot_class: boolean;
  created_at: string;
  student_count: number;
  logged_periods: number;
}

export interface TeacherResource {
  id: string;
  lesson_no: number;
  title: string;
  resource_type: "lesson_plan" | "bilingual_slide" | "worksheet" | "glossary_card";
  clil_mode: ClilMode;
  content_markdown: string;
  is_official: boolean;
}

export interface QuestionBankItem {
  id: string;
  lesson_no: number;
  language: "vi" | "en";
  cognitive_level: string;
  discipline: string;
  prompt_text: string;
  options: string[];
  correct_answer: string;
  explanation_vi: string;
  linter_verified: boolean;
}

export interface ExamQuestion {
  order_no: number;
  question_id: string;
  lesson_no: number;
  language: "vi" | "en";
  cognitive_level: string;
  discipline: string;
  points: number;
  prompt_text: string;
  options: string[];
  correct_answer: string;
  explanation_vi: string;
}

export interface ExamSummary {
  id: string;
  title: string;
  classroom_id: string | null;
  target_en_ratio: number;
  achieved_en_ratio: number;
  total_points: number;
  duration_minutes: number;
  question_count: number;
  created_at: string;
}

export interface ExamDetail extends ExamSummary {
  en_points: number;
  vi_points: number;
  meets_tt94_10: boolean;
  meets_tt94_50: boolean;
  questions: ExamQuestion[];
}

export interface AssignmentItem {
  id: string;
  classroom_id: string;
  classroom_name: string;
  exam_id: string;
  title: string;
  total_points: number;
  achieved_en_ratio: number;
  duration_minutes: number;
  due_at: string | null;
  created_at: string;
  submitted: boolean;
  student_score: number | null;
}

export interface AssignmentTake {
  assignment_id: string;
  title: string;
  classroom_name: string;
  total_points: number;
  achieved_en_ratio: number;
  duration_minutes: number;
  questions: Array<{
    order_no: number;
    question_id: string;
    language: "vi" | "en";
    points: number;
    prompt_text: string;
    options: string[];
  }>;
}

export interface SubmissionResult {
  submission_id: string;
  assignment_id: string;
  score: number;
  max_score: number;
  vi_score: number;
  en_score: number;
  submitted_at: string;
}

export interface ClassroomAnalytics {
  classroom_id: string;
  classroom_name: string;
  student_count: number;
  submissions_count: number;
  average_score: number;
  average_en_score: number;
  submissions: Array<{
    student_id: string;
    student_name: string;
    assignment_title: string;
    score: number;
    max_score: number;
    vi_score: number;
    en_score: number;
    submitted_at: string;
  }>;
  weak_questions: Array<{
    question_id: string;
    prompt_text: string;
    language: string;
    miss_count: number;
    total_attempts: number;
  }>;
}

export interface TeachingSessionLog {
  id: string;
  classroom_id: string;
  teacher_id: string;
  lesson_no: number;
  taught_date: string;
  periods_count: number;
  clil_mode: ClilMode;
  english_minutes: number;
  notes: string | null;
  created_at: string;
}

export interface TT94ComplianceReport {
  tenant_id: string;
  tenant_name: string;
  academic_year: string;
  total_classrooms: number;
  classrooms_meeting_35_periods: number;
  classrooms_meeting_105_periods: number;
  total_periods_logged: number;
  total_exams_generated: number;
  exams_meeting_10_pct: number;
  exams_meeting_50_pct: number;
  estimated_tt94_level: number;
  level_label: string;
  next_level_gaps: string[];
  classrooms: Array<{
    classroom_id: string;
    classroom_name: string;
    is_tt94_pilot_class: boolean;
    student_count: number;
    total_periods_logged: number;
    total_english_minutes: number;
    meets_35_periods: boolean;
    meets_105_periods: boolean;
  }>;
}
