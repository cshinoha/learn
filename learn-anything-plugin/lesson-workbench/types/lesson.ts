/**
 * Типы для `.lesson.json` — канонического формата урока.
 * См. learn-anything-plugin/docs/lesson-workbench-tz.md разделы 4–6.
 */

// --- Общие поля блока (discriminated union по type) ---

export interface BaseBlock {
  order: number;
}

export interface TitleBlock extends BaseBlock {
  type: "title";
  content: string;
}

export interface IntroBlock extends BaseBlock {
  type: "intro";
  content: string;
}

export interface ExplanationBlock extends BaseBlock {
  type: "explanation";
  content: string;
  citation_refs?: string[];
}

export interface RuleBlock extends BaseBlock {
  type: "rule";
  statement: string;
  examples: string[];
}

export interface HighlightRange {
  start: number;
  end: number;
  label: string;
  tone: "danger" | "warning" | "info" | "neutral";
}

export interface CodeTraceBlock extends BaseBlock {
  type: "code_trace";
  language: string;
  content: string;
  highlights?: HighlightRange[];
}

export interface DiagramNode {
  key: string;
  label: string;
  text: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramBlock extends BaseBlock {
  type: "diagram";
  title?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface LegendItem {
  label: string;
  meaning: string;
  tone: "danger" | "warning" | "info" | "neutral";
}

export interface LegendBlock extends BaseBlock {
  type: "legend";
  items: LegendItem[];
}

export interface RecallQuestionBlock extends BaseBlock {
  type: "recall_question";
  prompt: string;
}

export interface QuizOption {
  key: string;
  text: string;
}

export interface QuizBlock extends BaseBlock {
  type: "quiz";
  prompt: string;
  options: QuizOption[];
  answer_key?: string[];
}

export interface ChecklistBlock extends BaseBlock {
  type: "checklist";
  items: string[];
}

export interface MisconceptionBlock extends BaseBlock {
  type: "misconception";
  claim: string;
  correction: string;
}

export interface FreeNoteBlock extends BaseBlock {
  type: "free_note";
  content: string;
}

/** Discriminated union всех блоков v1 */
export type LessonBlock =
  | TitleBlock
  | IntroBlock
  | ExplanationBlock
  | RuleBlock
  | CodeTraceBlock
  | DiagramBlock
  | LegendBlock
  | RecallQuestionBlock
  | QuizBlock
  | ChecklistBlock
  | MisconceptionBlock
  | FreeNoteBlock;

// --- Lesson top-level ---

export interface LessonDocument {
  topic: string;
  title: string;
  source: "lesson-studio" | "training-conductor";
  created_at: string; // ISO 8601
  blocks: LessonBlock[];
}
