/**
 * lesson-server.ts — Bun-сервер Lesson Workbench.
 *
 * Режимы:
 *   1. Web-сервер (default): раздаёт effective HTML, принимает feedback
 *   2. CLI render:      --render → выводит HTML в stdout
 *
 * Запуск:
 *   bun run server/lesson-server.ts samples/thread-dump-http-response-wait.lesson.json
 *   bun run server/lesson-server.ts samples/... --render   → HTML в stdout
 *
 * Endpoints:
 *   GET  /             → effective-format HTML страница урока
 *   POST /api/feedback → сохраняет lesson-feedback.json
 */
import { join, dirname, basename, extname } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import type { LessonDocument } from "../types/lesson.ts";
import type { LessonFeedback } from "../types/feedback.ts";
import { generateLessonHtml } from "../renderer/lessonHtml.ts";
import { buildFeedback } from "../feedback/serializer.ts";

// ====================================================================
// CLI
// ====================================================================

const lessonPath = process.argv[2] ?? process.env.LESSON_PATH;
const isRenderOnly = process.argv.includes("--render");

if (!lessonPath) {
  console.error("Usage: lesson-server.ts <path-to-lesson.json> [--render]");
  console.error("  --render  output HTML to stdout and exit");
  process.exit(1);
}

// ====================================================================
// Load lesson
// ====================================================================

interface LessonState {
  document: LessonDocument;
  fileName: string;
  fileDir: string;
  htmlCache: string;
}

async function loadState(filePath: string): Promise<LessonState> {
  const abs = join(process.cwd(), filePath);
  const content = await readFile(abs, "utf-8");
  const document: LessonDocument = JSON.parse(content);
  const fileName = basename(abs);
  const fileDir = dirname(abs);
  const htmlCache = generateLessonHtml(document, fileName);
  return { document, fileName, fileDir, htmlCache };
}

// ====================================================================
// CLI render mode
// ====================================================================

if (isRenderOnly) {
  const state = await loadState(lessonPath);
  console.log(state.htmlCache);
  process.exit(0);
}

// ====================================================================
// Web server
// ====================================================================

const state = await loadState(lessonPath);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── GET / — serve effective HTML ──
  if (req.method === "GET" && url.pathname === "/") {
    return new Response(state.htmlCache, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  // ── GET /api/lesson — serve raw JSON ──
  if (req.method === "GET" && url.pathname === "/api/lesson") {
    return json({
      lesson: state.document,
      lessonFileName: state.fileName,
      version: 1,
    });
  }

  // ── POST /api/feedback — save feedback ──
  if (req.method === "POST" && url.pathname === "/api/feedback") {
    try {
      const body = await req.json();
      const rawActions: any[] = body.actions ?? [];

      const feedback = buildFeedback(
        body.lesson_file ?? state.fileName,
        rawActions,
        state.document.blocks,
      );

      // Write to disk
      const feedbackName = state.fileName.replace(extname(state.fileName), ".feedback.json");
      const feedbackPath = join(state.fileDir, feedbackName);
      await writeFile(feedbackPath, JSON.stringify(feedback, null, 2), "utf-8");

      console.error(`Feedback saved: ${feedbackPath}`);
      console.error(`  actions: ${feedback.actions.length}`);
      console.error(`  summary: ${feedback.learner_summary}`);

      return json({
        saved: true,
        path: feedbackPath,
        actionCount: feedback.actions.length,
        summary: feedback.learner_summary,
      });
    } catch (err) {
      console.error("Feedback error:", err);
      return json({ saved: false, error: String(err) }, 500);
    }
  }

  return new Response("Not found", { status: 404 });
}

const server = Bun.serve({
  port: parseInt(process.env.PORT ?? "3847", 10),
  fetch: handleRequest,
});

const url = `http://localhost:${server.port}`;
console.error(`Lesson Workbench server running at ${url}`);
console.error(`Lesson: ${state.fileName} (${state.document.blocks.length} blocks)`);
console.error(`Open ${url} in your browser`);
console.error("Press Ctrl+C to stop");
