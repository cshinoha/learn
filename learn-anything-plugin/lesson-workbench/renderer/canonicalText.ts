/**
 * toAnnotationText — canonical text для каждого типа блока.
 *
 * Offsets для annotation / highlight считаются относительно этой строки.
 * Renderer обязан использовать эту функцию для расчёта start/end.
 *
 * См. ТЗ §7 "Annotation text и offsets".
 */
import type { LessonBlock } from "../types/lesson.ts";

export function toAnnotationText(block: LessonBlock): string {
  switch (block.type) {
    case "title":
    case "intro":
    case "explanation":
    case "free_note":
      return block.content;

    case "rule":
      return [block.statement, ...block.examples].join("\n");

    case "code_trace":
      return block.content;

    case "diagram": {
      // Текстовая репрезентация: "метка → метка (подпись)" для каждой связи
      const lines = [
        ...block.nodes.map((n) => `${n.key}: ${n.label}`),
        ...block.edges.map((e) => `${e.from} → ${e.to}${e.label ? ` (${e.label})` : ""}`),
      ];
      return lines.join("\n");
    }

    case "legend":
      return block.items.map((i) => `${i.label}: ${i.meaning}`).join("\n");

    case "recall_question":
      return block.prompt;

    case "quiz":
      return [block.prompt, ...block.options.map((o) => `${o.key}: ${o.text}`)].join("\n");

    case "checklist":
      return block.items.join("\n");

    case "misconception":
      return `❌ ${block.claim}\n✅ ${block.correction}`;

    default:
      return "";
  }
}
