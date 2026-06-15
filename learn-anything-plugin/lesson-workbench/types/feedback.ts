/**
 * Типы для lesson-feedback.json — выхода Lesson Workbench.
 * См. learn-anything-plugin/docs/lesson-workbench-tz.md разделы 7–9.
 */

// --- Feedback actions (discriminated union) ---

export interface BaseAction {
  order: number;
}

/** Комментарий ко всему блоку, не привязан к тексту */
export interface CommentAction extends BaseAction {
  action: "comment";
  note: string;
}

/** Аннотация к диапазону текста внутри canonical text блока */
export interface AnnotationAction extends BaseAction {
  action: "annotation";
  start: number;
  end: number;
  note: string;
}

/** Выделение текста пользователем */
export interface HighlightAction extends BaseAction {
  action: "highlight";
  start: number;
  end: number;
  reason: string;
}

/** Свободный ответ пользователя */
export interface AnswerAction extends BaseAction {
  action: "answer";
  answer: string;
}

/** Выбор варианта(ов) в quiz/опроснике */
export interface ChoiceAction extends BaseAction {
  action: "choice";
  choices: string[];
}

/** Оценка сложности (scale 1..5, 1=очень легко, 5=очень трудно) */
export interface DifficultyAction extends BaseAction {
  action: "difficulty";
  rating: number; // 1–5
}

/** Предложение добавить заметку/пример рядом с блоком */
export interface InsertNoteAction extends BaseAction {
  action: "insert_note";
  note: string;
}

export type FeedbackAction =
  | CommentAction
  | AnnotationAction
  | HighlightAction
  | AnswerAction
  | ChoiceAction
  | DifficultyAction
  | InsertNoteAction;

// --- Feedback top-level ---

export interface LessonFeedback {
  lesson_file: string; // имя файла версии урока, e.g. "v001.lesson.json"
  created_at: string; // ISO 8601
  learner_summary: string; // короткая сводка по действиям пользователя
  actions: FeedbackAction[];
}
