/**
 * serializeFeedback — формирует lesson-feedback.json из массива действий.
 *
 * См. ТЗ §8–9.
 */
import type { LessonBlock } from "../types/lesson.ts";
import type { LessonFeedback, FeedbackAction } from "../types/feedback.ts";
import { toAnnotationText } from "../renderer/canonicalText.ts";

interface FeedbackInput {
  action: string;
  order: number;
  start?: number;
  end?: number;
  note?: string;
  answer?: string;
  choices?: string[];
  rating?: number;
  reason?: string;
  entire_block?: boolean;
}

/** Создать LessonFeedback из массива сырых actions */
export function buildFeedback(
  lessonFileName: string,
  inputActions: FeedbackInput[],
  blocks: LessonBlock[],
): LessonFeedback {
  const actions: FeedbackAction[] = inputActions.map((a) => {
    switch (a.action) {
      case "comment":
        return { order: a.order, action: "comment", note: a.note ?? "" };
      case "annotation":
        return {
          order: a.order,
          action: "annotation",
          start: a.start ?? 0,
          end: a.end ?? 0,
          note: a.note ?? "",
        };
      case "highlight":
        if ((a as any).entire_block) {
          // whole-block highlight: compute canonical text length
          const block = blocks.find((b) => b.order === a.order);
          const textLen = block ? toAnnotationText(block).length : 0;
          return {
            order: a.order,
            action: "highlight",
            start: 0,
            end: textLen,
            reason: a.reason ?? "important",
          };
        }
        return {
          order: a.order,
          action: "highlight",
          start: a.start ?? 0,
          end: a.end ?? 0,
          reason: a.reason ?? "important",
        };
      case "answer":
        return { order: a.order, action: "answer", answer: a.answer ?? "" };
      case "choice":
        return { order: a.order, action: "choice", choices: a.choices ?? [] };
      case "difficulty":
        return { order: a.order, action: "difficulty", rating: Math.min(5, Math.max(1, a.rating ?? 3)) };
      case "insert_note":
        return { order: a.order, action: "insert_note", note: a.note ?? "" };
      default:
        return { order: a.order, action: "comment", note: JSON.stringify(a) };
    }
  });

  // Формируем краткую сводку для Training Conductor
  const summaryParts: string[] = [];
  const actionCount = actions.length;
  if (actionCount > 0) {
    summaryParts.push(`${actionCount} action(s)`);
    const highlighted = actions.filter((a) => a.action === "highlight").length;
    const commented = actions.filter((a) => a.action === "comment").length;
    const answered = actions.filter((a) => a.action === "answer" || a.action === "choice").length;
    const difficulties = actions.filter((a) => a.action === "difficulty");
    if (highlighted > 0) summaryParts.push(`${highlighted} highlight(s)`);
    if (commented > 0) summaryParts.push(`${commented} comment(s)`);
    if (answered > 0) summaryParts.push(`${answered} answer(s)`);
    if (difficulties.length > 0) {
      const avg = difficulties.reduce((s, a) => s + (a as any).rating, 0) / difficulties.length;
      summaryParts.push(`avg difficulty ${avg.toFixed(1)}/5`);
    }
  }

  return {
    lesson_file: lessonFileName,
    created_at: new Date().toISOString(),
    learner_summary: summaryParts.join("; ") || "No actions recorded.",
    actions,
  };
}
