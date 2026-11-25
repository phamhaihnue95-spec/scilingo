export type Discipline = "general_lab" | "chemistry" | "physics" | "biology";
export type GradeLevel = 6 | 7 | 8 | 9;

export interface GradeOverview {
  grade: GradeLevel;
  title_vi: string;
  title_en: string;
  total_chapters: number;
  total_lessons: number;
  total_terms: number;
}

export interface LessonSummary {
  id: string;
  grade?: GradeLevel;
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
  grade?: GradeLevel;
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
  target_grade?: GradeLevel;
  target_lesson_no: number;
  target_title_vi: string;
  target_title_en: string;
  target_discipline: Discipline;
  note_vi: string;
}

export interface LessonDetail {
  id: string;
  grade?: GradeLevel;
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
  target_grade?: GradeLevel | null;
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
  grade?: GradeLevel;
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
  grade?: GradeLevel;
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
  grade?: GradeLevel;
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

export interface GradeTT94Metrics {
  grade: GradeLevel;
  classrooms_count: number;
  students_count: number;
  periods_logged: number;
  english_minutes: number;
  exams_count: number;
  exams_meeting_10_pct: number;
  exams_meeting_50_pct: number;
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
  grade_breakdown?: GradeTT94Metrics[];
}

export interface StudyPackItem {
  unit_no: number;
  unit_title_en: string;
  unit_title_vi: string;
  discipline: Discipline;
  order_no: number;
  term_en: string;
  ipa: string;
  pos: string;
  meaning_vi: string;
  iupac_note: string | null;
}

export interface StudyPackUnitSummary {
  unit_no: number;
  title_en: string;
  title_vi: string;
  discipline: Discipline;
  kntt8_related_lessons: number[];
  related_lessons_by_grade?: Record<string, number[]>;
  item_count: number;
}

export interface StudyPackOverview {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  source_org: string;
  school_context: string;
  total_units: number;
  total_items: number;
  units: StudyPackUnitSummary[];
}

export interface StudyPackUnitDetail {
  unit: StudyPackUnitSummary;
  items: StudyPackItem[];
}

export interface StudyPackSearchResponse {
  total: number;
  items: StudyPackItem[];
}

export interface StudyPackQuizQuestion {
  index: number;
  unit_no: number;
  language: "vi" | "en";
  prompt_text: string;
  options: string[];
  correct_index: number;
  points: number;
  ipa: string;
  iupac_note: string | null;
  explanation_vi: string;
}

export interface StudyPackQuiz {
  title: string;
  unit_nos: number[];
  mode: PracticeMode;
  total_points: number;
  en_points: number;
  vi_points: number;
  english_ratio: number;
  questions: StudyPackQuizQuestion[];
}

export type GameType = "lightning_match" | "iupac_lab" | "sequence_lab";

export interface GameRewardPayload {
  game_type: GameType;
  correct_count: number;
  total_attempts: number;
  max_combo: number;
  discipline: Discipline;
  study_pack_unit_no?: number;
}

export interface GameRewardResult {
  game_type: GameType;
  xp_earned: number;
  total_xp: number;
  level: number;
  current_streak: number;
  newly_unlocked_badges: string[];
}

export interface LeaderboardEntry {
  rank: number;
  student_id: string;
  student_name: string;
  total_xp: number;
  level: number;
  current_streak: number;
  badges_count: number;
  scidex_count: number;
  badges: string[];
  avg_assignment_score: number | null;
  pet_species?: PetSpecies | string | null;
  pet_nickname?: string | null;
  pet_stage?: number | null;
  pet_accessory?: string | null;
}

export type PetSpecies = "owl" | "fox" | "cat";
export type PetHabitat = "lab" | "cosmos" | "forest" | "atom";
export type PetTreatType = "h2o" | "glucose" | "photon";
export type PetMood = "ecstatic" | "happy" | "sleepy";

export interface PetAccessoryCatalogItem {
  id: string;
  name_vi: string;
  icon: string;
  unlock_hint_vi: string;
  unlocked: boolean;
}

export interface PetHabitatCatalogItem {
  id: string;
  name_vi: string;
  icon: string;
  unlock_hint_vi: string;
  unlocked: boolean;
}

export interface StudentPetState {
  student_id: string;
  species: PetSpecies;
  species_name_vi: string;
  nickname: string;
  level: number;
  total_xp: number;
  current_streak: number;
  stage: number;
  stage_label_vi: string;
  stage_label_en: string;
  next_evolution_level: number | null;
  xp_to_next_level: number;
  energy: number;
  mood: PetMood;
  treat_points_available: number;
  total_treats_earned: number;
  fed_count: number;
  petted_count: number;
  equipped_accessory: string | null;
  equipped_habitat: PetHabitat;
  unlocked_accessories: string[];
  unlocked_habitats: string[];
  accessories_catalog: PetAccessoryCatalogItem[];
  habitats_catalog: PetHabitatCatalogItem[];
  last_fed_at: string | null;
}

export interface StudentPetActionResult {
  pet: StudentPetState;
  reaction_vi: string;
  reaction_en: string;
}

export interface ClassroomLeaderboard {
  classroom_id: string;
  classroom_name: string;
  join_code: string;
  total_students: number;
  entries: LeaderboardEntry[];
}

export interface GameChallengeCreatePayload {
  title: string;
  game_type: GameType;
  unit_no?: number | null;
  target_score?: number;
  duration_minutes?: number;
  instructions?: string;
}

export interface ClassroomGameChallenge {
  id: string;
  classroom_id: string;
  classroom_name: string;
  title: string;
  game_type: GameType;
  unit_no: number | null;
  target_score: number;
  duration_minutes: number;
  instructions: string;
  created_by_name: string;
  created_at: string;
}

// --- CMS Types (Phase 1 + Phase 2) ---
export interface LintIssue {
  matched_text: string;
  recommended: string;
  discipline: string;
  severity: "error" | "warning" | string;
  reason: string;
}

export interface LintCheckResult {
  passed: boolean;
  error_count: number;
  warning_count: number;
  issues: LintIssue[];
  exception_notes: string[];
}

export interface CmsAuditLog {
  id: string;
  tenant_id: string | null;
  actor_user_id: string | null;
  actor_email: string;
  actor_name: string;
  module: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  diff_json: Record<string, unknown>;
  created_at: string;
}

export interface CmsOverview {
  scope: "platform" | "school";
  tenant_name: string;
  total_tenants: number;
  total_users: number;
  active_users: number;
  users_by_role: Record<string, number>;
  total_grades: number;
  total_lessons: number;
  total_terms: number;
  verified_terms: number;
  draft_terms: number;
  total_classrooms: number;
  total_questions: number;
  verified_questions: number;
  total_resources: number;
  total_teaching_periods: number;
  recent_audit_logs: CmsAuditLog[];
}

export interface CmsTenantDetail {
  id: string;
  name: string;
  tenant_type: string;
  province: string | null;
  district: string | null;
  target_tt94_level: number | null;
  created_at: string;
  user_count: number;
  plan_code: string;
  ai_monthly_quota: number;
  ai_used_this_month: number;
  subscription_status: string;
}

export interface CmsCsvImportResult {
  created_count: number;
  skipped_count: number;
  errors: string[];
}

export interface CmsLessonItem {
  id: string;
  grade: GradeLevel;
  chapter_no: number;
  chapter_title_vi: string;
  lesson_no: number;
  title_vi: string;
  title_en: string;
  discipline: Discipline;
  is_practical: boolean;
  summary_vi: string | null;
  summary_en: string | null;
  term_count: number;
  integration_links_json: Array<Record<string, unknown>>;
}

export interface CmsLessonList {
  total: number;
  items: CmsLessonItem[];
}

export interface CmsLessonUpdateResponse {
  lesson: LessonDetail;
  lint_report: LintCheckResult;
}

export interface CmsTermItem extends TermSummary {
  part_of_speech?: string | null;
  definition_vi?: string | null;
  definition_en?: string | null;
  example_en?: string | null;
  example_vi?: string | null;
  lesson_ids: string[];
  lesson_count: number;
}

export interface CmsTermList {
  total: number;
  items: CmsTermItem[];
}

export interface CmsTermMutationOut {
  term: CmsTermItem;
  lint_report: LintCheckResult;
}

export interface CmsQuestionItem extends QuestionBankItem {
  grade: GradeLevel;
  tenant_id: string | null;
  is_official: boolean;
  author_id: string | null;
  created_at: string;
  lint_report?: LintCheckResult | null;
}

export interface CmsQuestionList {
  total: number;
  items: CmsQuestionItem[];
}

export interface CmsQuestionCsvImportOut {
  imported_count: number;
  verified_count: number;
  flagged_count: number;
  errors: string[];
}

export interface CmsResourceItem extends TeacherResource {
  grade: GradeLevel;
  tenant_id: string | null;
  created_at: string;
  lint_report?: LintCheckResult | null;
}

export interface CmsResourceList {
  total: number;
  items: CmsResourceItem[];
}
