/**
 * lessonHtml — генератор effective-format HTML из LessonDocument.
 *
 * Паттерн:
 *   .lesson.json → lessonHtml() → self-contained .html с effective-стилем
 *
 * Фичи:
 *   - Все 12 блоков урока с тоновой раскраской (clay/olive/gold)
 *   - Тёмная тема через CSS-переменные + localStorage
 *   - Vanilla JS для интерактива: highlight, difficulty, comment, ответы
 *   - Сбор feedback и POST /api/feedback
 *   - diagram → inline SVG с кликабельными узлами
 *   - code_trace → подсветка строк по highlights
 */
import type { LessonDocument, LessonBlock, HighlightRange, DiagramBlock } from "../types/lesson.ts";
import { toAnnotationText } from "./canonicalText.ts";

// ────────────────────────────────────────────────────────────────────
// CSS
// ────────────────────────────────────────────────────────────────────

const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #FAF9F5; --surface: #FFFFFF; --surface2: #F0EEE6;
  --ink: #141413; --body: #3D3D3A; --muted: #87867F;
  --line: #D1CFC5; --line-soft: #E6E3DA;
  --clay: #D97757; --clay-soft: rgba(217,119,87,0.10);
  --olive: #788C5D; --olive-soft: rgba(120,140,93,0.12);
  --gold: #C9A45C; --gold-soft: rgba(201,164,92,0.12);
  --blue: #5B7E96; --blue-soft: rgba(91,126,150,0.12);
  --serif: ui-serif, Georgia, "Times New Roman", serif;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
html.dark {
  --bg: #141413; --surface: #1F1F1D; --surface2: #2A2A28;
  --ink: #FAF9F5; --body: #D1CFC5; --muted: #87867F;
  --line: #3D3D3A; --line-soft: #2A2A28;
  --clay: #E48A6E; --clay-soft: rgba(228,138,110,0.14);
  --olive: #9DB07C; --olive-soft: rgba(157,176,124,0.16);
  --gold: #D4B36F; --gold-soft: rgba(212,179,111,0.16);
  --blue: #7FA3BC; --blue-soft: rgba(127,163,188,0.14);
}

body {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--body);
  -webkit-font-smoothing: antialiased;
  line-height: 1.6;
}

/* ── bar ─────────────────────────────── */
.bar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 12px 20px; border-bottom: 1px solid var(--line-soft);
  position: sticky; top: 0; z-index: 50;
  background: var(--surface);
}
.bar h1 { font-family: var(--serif); font-weight: 500; font-size: 18px; color: var(--ink); letter-spacing: -0.01em; }
.bar .sub { font-family: var(--mono); font-size: 10.5px; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; }
.spacer { flex: 1; }
#themeToggle {
  font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em;
  padding: 5px 10px; border: 1px solid var(--line); border-radius: 6px;
  background: transparent; color: var(--muted); cursor: pointer;
}
#themeToggle:hover { color: var(--ink); border-color: var(--muted); }

/* ── sheet ───────────────────────────── */
.sheet { max-width: 820px; margin: 0 auto; padding: 40px 24px 80px; }

/* ── blocks ──────────────────────────── */
.block {
  margin-bottom: 28px;
  padding: 16px 20px;
  border-radius: 8px;
  border: 1px solid var(--line-soft);
  background: var(--surface);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.block:hover { border-color: var(--line); }

.block-title {
  font-family: var(--serif); font-size: 32px; line-height: 1.25;
  color: var(--ink); font-weight: 500; letter-spacing: -0.02em;
  padding: 0; margin-bottom: 0;
  border: none; background: none;
}
.block-intro {
  font-family: var(--sans); font-size: 16px;
  color: var(--muted); padding: 0; border: none; background: none;
}
.block-explanation {
  font-family: var(--serif); font-size: 16px; color: var(--body);
  padding: 0; border: none; background: none;
}
.block-explanation sup { color: var(--blue); cursor: help; font-size: 11px; }

/* rule */
.block-rule {
  border-left: 3px solid var(--clay);
  background: var(--clay-soft);
}
.block-rule .rule-statement {
  font-family: var(--serif); font-size: 16px; font-weight: 500; color: var(--ink);
  margin-bottom: 8px;
}
.block-rule .rule-examples {
  font-family: var(--mono); font-size: 13px; color: var(--muted);
  padding-left: 16px; border-left: 2px solid var(--line-soft);
}

/* code_trace */
.block-code_trace {
  background: var(--surface2);
  padding: 12px 16px;
}
.block-code_trace pre {
  overflow-x: auto;
  font-family: var(--mono); font-size: 13px; line-height: 1.5;
  color: var(--body);
  tab-size: 2;
}
.block-code_trace .hl { display: inline; background: transparent; }
.block-code_trace .hl.danger { background: var(--clay-soft); border-left: 2px solid var(--clay); }
.block-code_trace .hl.warning { background: var(--gold-soft); border-left: 2px solid var(--gold); }
.block-code_trace .hl.info { background: var(--blue-soft); border-left: 2px solid var(--blue); }
.block-code_trace .hl.neutral { background: var(--surface2); }

/* diagram */
.block-diagram .diagram-stage {
  width: 100%; min-height: 220px;
  border: 1px solid var(--line-soft); border-radius: 6px;
  background: var(--bg); margin-top: 8px;
}
.block-diagram .diagram-stage svg { display: block; width: 100%; height: auto; }
.diag-node { cursor: pointer; }
.diag-node rect { fill: var(--surface); stroke: var(--line); stroke-width: 1.5; rx: 8; transition: stroke 0.15s; }
.diag-node:hover rect { stroke: var(--clay); }
.diag-node text { font-family: var(--sans); font-size: 13px; fill: var(--ink); pointer-events: none; }
.diag-node .sub { font-size: 11px; fill: var(--muted); }
.diag-edge { stroke: var(--muted); stroke-width: 1.5; fill: none; }
.diag-label { font-family: var(--mono); font-size: 10px; fill: var(--muted); }

/* legend */
.block-legend .legend-grid {
  display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; align-items: center;
}
.block-legend .legend-dot {
  display: inline-block; width: 10px; height: 10px; border-radius: 50%;
}
.block-legend .legend-dot.danger { background: var(--clay); }
.block-legend .legend-dot.warning { background: var(--gold); }
.block-legend .legend-dot.info { background: var(--blue); }
.block-legend .legend-dot.neutral { background: var(--muted); }

/* recall_question */
.block-recall_question { border-left: 3px solid var(--blue); background: var(--blue-soft); }
.block-recall_question .prompt { font-family: var(--serif); font-size: 16px; color: var(--ink); margin-bottom: 10px; }
.block-recall_question textarea {
  width: 100%; min-height: 60px; padding: 8px 10px;
  font-family: var(--sans); font-size: 14px;
  border: 1px solid var(--line); border-radius: 6px;
  background: var(--surface); color: var(--body);
  resize: vertical;
}

/* quiz */
.block-quiz { border-left: 3px solid var(--olive); background: var(--olive-soft); }
.block-quiz .prompt { font-family: var(--serif); font-size: 16px; color: var(--ink); margin-bottom: 10px; }
.block-quiz .quiz-option {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; margin-bottom: 4px;
  border-radius: 6px; cursor: pointer;
  font-family: var(--sans); font-size: 14px; color: var(--body);
}
.block-quiz .quiz-option:hover { background: var(--surface2); }
.block-quiz .quiz-option input { accent-color: var(--olive); }

/* checklist */
.block-checklist .checklist-item {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0; font-family: var(--sans); font-size: 14px; color: var(--body);
}
.block-checklist .checklist-item input { accent-color: var(--olive); }
.block-checklist .checklist-item.checked { color: var(--muted); text-decoration: line-through; }

/* misconception */
.block-misconception {
  border-left: 3px solid var(--gold);
  background: var(--gold-soft);
}
.block-misconception .claim { color: var(--clay); font-weight: 500; margin-bottom: 6px; }
.block-misconception .claim::before { content: "✖ "; }
.block-misconception .correction { color: var(--olive); font-weight: 500; }
.block-misconception .correction::before { content: "✓ "; }

/* free_note */
.block-free_note {
  border-left: 3px solid var(--muted);
  font-style: italic;
}

/* ── block actions ───────────────────── */
.block-actions {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line-soft);
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
}
.block-actions .act-btn {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.04em;
  padding: 4px 10px; border: 1px solid var(--line); border-radius: 6px;
  background: transparent; color: var(--muted); cursor: pointer;
  transition: all 0.12s;
}
.block-actions .act-btn:hover { color: var(--ink); border-color: var(--muted); }
.block-actions .act-btn.on { background: var(--clay); color: #fff; border-color: var(--clay); }
/* highlighted block */
.block-actions .comment-box {
  flex: 1; min-width: 180px;
}
.block-actions .comment-box textarea {
  width: 100%; padding: 4px 8px;
  font-family: var(--sans); font-size: 12px;
  border: 1px solid var(--line); border-radius: 6px;
  background: var(--surface); color: var(--body);
  resize: vertical; min-height: 28px;
}
.stars { display: inline-flex; gap: 3px; }
.stars button {
  font-size: 18px; background: none; border: none; cursor: pointer;
  color: var(--line); transition: color 0.12s; padding: 0 2px;
}
.stars button:hover, .stars button.on { color: var(--gold); }

/* ── submit ──────────────────────────── */
.submit-bar {
  position: sticky; bottom: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 12px; background: var(--surface); border-top: 1px solid var(--line);
}
#submitFeedback {
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase;
  padding: 8px 24px; border: none; border-radius: 8px;
  background: var(--clay); color: #fff; cursor: pointer;
  transition: opacity 0.15s;
}
#submitFeedback:hover { opacity: 0.85; }
#submitFeedback:disabled { opacity: 0.4; cursor: default; }
#submitStatus { font-family: var(--sans); font-size: 12px; color: var(--muted); }

/* ── floating highlight toolbar ──────── */
#hlToolbar {
  position: fixed; display: none;
  background: var(--surface); border: 1px solid var(--line); border-radius: 8px;
  padding: 4px 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 100; gap: 4px;
}
#hlToolbar button {
  font-family: var(--mono); font-size: 11px;
  padding: 4px 8px; border: 1px solid var(--line-soft); border-radius: 4px;
  background: transparent; color: var(--muted); cursor: pointer;
}
#hlToolbar button:hover { color: var(--ink); border-color: var(--muted); }

/* ── annotation markers ───────────────── */
.annotated {
  background: var(--gold-soft);
  border-bottom: 2px solid var(--gold);
  cursor: help;
  padding: 0 2px;
  border-radius: 2px;
}
`;

// ────────────────────────────────────────────────────────────────────
// JS (injected at bottom of page)
// ────────────────────────────────────────────────────────────────────

const JS = `
(function() {
  const actions = [];

  // ── Floating annotation toolbar ──
  const toolbar = document.getElementById('hlToolbar');
  let selBlockOrder = null;

  document.addEventListener('mouseup', function(e) {
    // Don't hide if clicking inside the toolbar itself
    if (toolbar.contains(e.target)) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      toolbar.style.display = 'none';
      return;
    }
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const blockEl = (container.nodeType === 3 ? container.parentElement : container)
      .closest('[data-order]');
    if (!blockEl) { toolbar.style.display = 'none'; return; }
    selBlockOrder = parseInt(blockEl.dataset.order);
    const rect = range.getBoundingClientRect();
    if (isNaN(selBlockOrder)) { toolbar.style.display = 'none'; return; }
    toolbar.style.display = 'flex';
    toolbar.style.top = (rect.top - 44) + 'px';
    toolbar.style.left = Math.max(8, rect.left + rect.width/2 - 60) + 'px';
  });

  document.getElementById('hlAnnot')?.addEventListener('click', function() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const blockEl = document.querySelector('[data-order="' + selBlockOrder + '"]');
    if (!blockEl) return;
    const range = sel.getRangeAt(0);
    const start = textOffset(blockEl, range.startContainer, range.startOffset);
    const end = textOffset(blockEl, range.endContainer, range.endOffset);
    const note = prompt('Your annotation note:');
    if (note) {
      actions.push({ order: selBlockOrder, action: 'annotation', start: start, end: end, note: note });
      markAnnotation(range, note, start, end);
    }
    sel.removeAllRanges();
    toolbar.style.display = 'none';
    updateSummary();
  });

  function textOffset(root, node, offset) {
    let pos = 0;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    while (walk.nextNode()) {
      const n = walk.currentNode;
      if (n === node) return pos + offset;
      pos += n.textContent.length;
    }
    return pos;
  }

  function markAnnotation(range, note, start, end) {
    const wrapper = document.createElement('span');
    wrapper.className = 'annotated';
    wrapper.title = note;
    wrapper.dataset.annStart = start;
    wrapper.dataset.annEnd = end;
    wrapper.textContent = range.toString();
    try {
      range.deleteContents();
      range.insertNode(wrapper);
    } catch(e) {}
  }

  // ── Click annotation to edit ──
  document.addEventListener('click', function(e) {
    var ann = e.target.closest('.annotated');
    if (!ann) return;
    e.preventDefault();
    e.stopPropagation();
    var order = parseInt(ann.closest('[data-order]').dataset.order);
    var start = parseInt(ann.dataset.annStart);
    var end = parseInt(ann.dataset.annEnd);
    var idx = -1;
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i];
      if (a.order === order && a.action === 'annotation' && a.start === start && a.end === end) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return;
    var newNote = prompt('Edit annotation note:', actions[idx].note);
    if (newNote !== null) {
      actions[idx].note = newNote;
      ann.title = newNote;
      updateSummary();
    }
  });

  // ── Difficulty ──
  document.querySelectorAll('[data-difficulty]').forEach(function(el) {
    const order = parseInt(el.dataset.difficulty);
    el.querySelectorAll('button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const rating = parseInt(this.dataset.star);
        el.querySelectorAll('button').forEach(function(b) {
          b.classList.toggle('on', parseInt(b.dataset.star) <= rating);
        });
        const existing = actions.findIndex(function(a) { return a.order === order && a.action === 'difficulty'; });
        const act = { order: order, action: 'difficulty', rating: rating };
        if (existing >= 0) { actions[existing] = act; } else { actions.push(act); }
        updateSummary();
      });
    });
  });

  // ── Comment (blur save) ──
  document.querySelectorAll('[data-comment]').forEach(function(el) {
    const order = parseInt(el.dataset.comment);
    const ta = el.querySelector('textarea');
    if (!ta) return;
    ta.addEventListener('blur', function() {
      const note = this.value.trim();
      if (!note) return;
      const existing = actions.findIndex(function(a) { return a.order === order && a.action === 'comment'; });
      const act = { order: order, action: 'comment', note: note };
      if (existing >= 0) { actions[existing] = act; } else { actions.push(act); }
      updateSummary();
    });
  });

  // ── Recall answer ──
  document.querySelectorAll('[data-answer]').forEach(function(el) {
    const order = parseInt(el.dataset.answer);
    const ta = el.querySelector('textarea');
    if (!ta) return;
    ta.addEventListener('blur', function() {
      const answer = this.value.trim();
      if (!answer) return;
      const existing = actions.findIndex(function(a) { return a.order === order && a.action === 'answer'; });
      const act = { order: order, action: 'answer', answer: answer };
      if (existing >= 0) { actions[existing] = act; } else { actions.push(act); }
      updateSummary();
    });
  });

  // ── Quiz choice ──
  document.querySelectorAll('[data-quiz]').forEach(function(el) {
    const order = parseInt(el.dataset.quiz);
    el.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        const checked = el.querySelectorAll('input:checked');
        const choices = Array.from(checked).map(function(c) { return c.value; });
        const existing = actions.findIndex(function(a) { return a.order === order && a.action === 'choice'; });
        const act = { order: order, action: 'choice', choices: choices };
        if (existing >= 0) { actions[existing] = act; } else { actions.push(act); }
        updateSummary();
      });
    });
  });

  // ── Insert note button ──
  document.querySelectorAll('.act-insert-note').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const block = this.closest('[data-order]');
      if (!block) return;
      const order = parseInt(block.dataset.order);
      const note = prompt('Your note / suggestion for this block:');
      if (note) {
        actions.push({ order: order, action: 'insert_note', note: note });
        updateSummary();
      }
    });
  });

  // ── Summary ──
  function updateSummary() {
    const el = document.getElementById('actionCount');
    if (el) el.textContent = actions.length + ' action(s)';
    localStorage.setItem('lw_actions_' + window._lessonFile, JSON.stringify(actions));
  }

  // ── Submit ──
  document.getElementById('submitFeedback')?.addEventListener('click', function() {
    const btn = this;
    const status = document.getElementById('submitStatus');
    btn.disabled = true;
    status.textContent = 'Saving...';

    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lesson_file: window._lessonFile,
        actions: actions
      })
    }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function(data) {
      status.textContent = 'Feedback saved! ✓';
      btn.disabled = false;
      // Clear local state after successful submit
      actions.length = 0;
      var el = document.getElementById('actionCount');
      if (el) el.textContent = '0 action(s)';
      localStorage.removeItem('lw_actions_' + window._lessonFile);
    }).catch(function(err) {
      status.textContent = 'Error: ' + err.message;
      btn.disabled = false;
    });
  });

  // ── Diagram node tooltips ──
  document.querySelectorAll('.diag-node').forEach(function(el) {
    el.addEventListener('click', function() {
      var tip = this.querySelector('.diag-tip');
      if (tip) {
        tip.style.display = tip.style.display === 'block' ? 'none' : 'block';
      }
    });
  });
})();
`;

// ────────────────────────────────────────────────────────────────────
// Block renderers
// ────────────────────────────────────────────────────────────────────

function renderTitle(block: LessonBlock): string {
  return `<div class="block block-title" data-order="${block.order}">
    <h1>${esc(block.content)}</h1>
    ${renderActions(block.order, { difficulty: true })}
  </div>`;
}

function renderIntro(block: LessonBlock): string {
  return `<div class="block block-intro" data-order="${block.order}">
    <p>${esc(block.content)}</p>
    ${renderActions(block.order, { difficulty: true })}
  </div>`;
}

function renderExplanation(block: LessonBlock): string {
  return `<div class="block block-explanation" data-order="${block.order}">
    <p class="block-text">${esc(block.content)}</p>
    ${renderActions(block.order, { difficulty: true, comment: true })}
  </div>`;
}

function renderRule(block: LessonBlock): string {
  return `<div class="block block-rule" data-order="${block.order}">
    <div class="rule-statement block-text">${esc(block.statement)}</div>
    <div class="rule-examples">${(block as any).examples.map((ex: string) => esc(ex)).join("\n")}</div>
    ${renderActions(block.order, { highlight: true, difficulty: true })}
  </div>`;
}

function renderCodeTrace(block: LessonBlock): string {
  const highlights: HighlightRange[] = (block as any).highlights ?? [];
  // Build line-by-line with highlight overlays
  const lines = block.content.split("\n");
  // Simple approach: for each line, check if it falls within any highlight range
  let pos = 0;
  const renderedLines = lines.map((line) => {
    const start = pos;
    const end = pos + line.length + 1; // +1 for newline
    pos = end;
    // Find highlights that cover this line
    const activeHL = highlights.filter((h) => h.start < end && h.end > start);
    const cls = activeHL.length > 0 ? ` class="hl ${activeHL[0].tone}"` : "";
    return `<span${cls}>${esc(line)}</span>`;
  });
  return `<div class="block block-code_trace" data-order="${block.order}">
    <pre class="block-text"><code>${renderedLines.join("\n")}</code></pre>
    ${renderActions(block.order, { difficulty: true, comment: true })}
  </div>`;
}

function renderDiagram(block: LessonBlock): string {
  const d = block as DiagramBlock;
  const svg = buildDiagramSVG(d);
  return `<div class="block block-diagram" data-order="${block.order}">
    ${d.title ? `<h3 style="font-family:var(--serif);font-size:16px;color:var(--ink);margin-bottom:8px;">${esc(d.title)}</h3>` : ""}
    <div class="diagram-stage">${svg}</div>
    ${renderActions(block.order, { difficulty: true, comment: true })}
  </div>`;
}

function renderLegend(block: LessonBlock): string {
  const items = (block as any).items ?? [];
  return `<div class="block block-legend" data-order="${block.order}">
    <div class="legend-grid">${
      items.map((i: any) => `
        <span class="legend-dot ${i.tone}"></span>
        <span><strong>${esc(i.label)}</strong> — ${esc(i.meaning)}</span>
      `).join("")
    }</div>
    ${renderActions(block.order, { difficulty: true })}
  </div>`;
}

function renderRecallQuestion(block: LessonBlock): string {
  const b = block as any;
  return `<div class="block block-recall_question" data-order="${block.order}">
    <div class="prompt">${esc(b.prompt)}</div>
    <div data-answer="${block.order}">
      <textarea placeholder="Your answer..." class="block-text"></textarea>
    </div>
    ${renderActions(block.order, { difficulty: true })}
  </div>`;
}

function renderQuiz(block: LessonBlock): string {
  const b = block as any;
  const options: any[] = b.options ?? [];
  return `<div class="block block-quiz" data-order="${block.order}">
    <div class="prompt">${esc(b.prompt)}</div>
    <div data-quiz="${block.order}">${
      options.map((o) => `
        <label class="quiz-option">
          <input type="radio" name="q_${block.order}" value="${esc(o.key)}">
          <span>${esc(o.text)}</span>
        </label>
      `).join("")
    }</div>
    ${renderActions(block.order, { difficulty: true })}
  </div>`;
}

function renderChecklist(block: LessonBlock): string {
  const items: string[] = (block as any).items ?? [];
  return `<div class="block block-checklist" data-order="${block.order}">
    ${items.map((item, i) => `
      <label class="checklist-item">
        <input type="checkbox">
        <span>${esc(item)}</span>
      </label>
    `).join("")}
  </div>`;
}

function renderMisconception(block: LessonBlock): string {
  return `<div class="block block-misconception" data-order="${block.order}">
    <div class="claim block-text">${esc((block as any).claim)}</div>
    <div class="correction">${esc((block as any).correction)}</div>
    ${renderActions(block.order, { difficulty: true, comment: true })}
  </div>`;
}

function renderFreeNote(block: LessonBlock): string {
  return `<div class="block block-free_note" data-order="${block.order}">
    <p class="block-text">${esc(block.content)}</p>
    ${renderActions(block.order, { difficulty: true })}
  </div>`;
}

// ── Action buttons for blocks ──

interface ActionOpts {
  difficulty?: boolean;
  comment?: boolean;
}

function renderActions(order: number, opts: ActionOpts): string {
  let html = `<div class="block-actions">`;

  if (opts.difficulty) {
    html += `<span class="stars" data-difficulty="${order}">
      ${[1,2,3,4,5].map((s) => `<button data-star="${s}">★</button>`).join("")}
    </span>`;
  }

  html += `<button class="act-btn act-insert-note" title="Suggest an addition">✎ Note</button>`;

  if (opts.comment) {
    html += `<span class="comment-box" data-comment="${order}">
      <textarea placeholder="Comment on this block..."></textarea>
    </span>`;
  }

  html += `</div>`;
  return html;
}

// ── SVG diagram builder ──

function buildDiagramSVG(d: DiagramBlock): string {
  const nodes = d.nodes;
  const edges = d.edges;
  if (nodes.length === 0) return "<p>—</p>";

  // Simple auto-layout: place nodes in a row, evenly spaced
  const nodeW = 180;
  const nodeH = 60;
  const gapX = 80;
  const padding = 40;

  const totalW = nodes.length * (nodeW + gapX) + gapX;
  const totalH = Math.max(220, nodeH + 100); // headroom for bezier curve

  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n, i) => {
    positions[n.key] = {
      x: padding + i * (nodeW + gapX),
      y: totalH / 2 - nodeH / 2,
    };
  });

  // Build SVG paths
  const edgePaths = edges.map((e) => {
    const from = positions[e.from];
    const to = positions[e.to];
    if (!from || !to) return "";
    const x1 = from.x + nodeW;
    const y1 = from.y + nodeH / 2;
    const x2 = to.x;
    const y2 = to.y + nodeH / 2;
    const cx = (x1 + x2) / 2;
    const yMid = Math.min(y1, y2) - 20;
    return `<path class="diag-edge" d="M${x1},${y1} C${cx},${y1} ${cx},${yMid} ${cx},${yMid} ${cx},${yMid} ${cx},${y2} ${x2},${y2}" marker-end="url(#arrow)"/>` +
      (e.label ? `<text class="diag-label" x="${cx}" y="${y1 - 8}" text-anchor="middle">${esc(e.label)}</text>` : "");
  }).join("\n");

  const nodeSvg = nodes.map((n) => {
    const p = positions[n.key];
    if (!p) return "";
    return `<g class="diag-node">
      <rect x="${p.x}" y="${p.y}" width="${nodeW}" height="${nodeH}"/>
      <text x="${p.x + nodeW / 2}" y="${p.y + nodeH / 2 - 4}" text-anchor="middle" dominant-baseline="auto" font-size="13" font-family="var(--sans)" fill="var(--ink)" pointer-events="none">${esc(n.label)}</text>
      <text x="${p.x + nodeW / 2}" y="${p.y + nodeH / 2 + 14}" text-anchor="middle" font-size="10" fill="var(--muted)" pointer-events="none">${esc(n.text.substring(0, 40))}</text>
      <foreignObject x="${p.x}" y="${p.y + nodeH}" width="${nodeW}" height="60" style="display:none;" class="diag-tip">
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:6px 8px;font-size:11px;color:var(--body);font-family:var(--sans);">
          ${esc(n.text)}
        </div>
      </foreignObject>
    </g>`;
  }).join("\n");

  return `<svg viewBox="0 0 ${totalW} ${totalH}" role="img" aria-label="${esc(d.title ?? "Diagram")}">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="currentColor" style="color:var(--muted)"/>
      </marker>
    </defs>
    ${edgePaths}
    ${nodeSvg}
  </svg>`;
}

// ── Helpers ──

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Main renderer ──

function renderBlock(block: LessonBlock): string {
  switch (block.type) {
    case "title": return renderTitle(block);
    case "intro": return renderIntro(block);
    case "explanation": return renderExplanation(block);
    case "rule": return renderRule(block);
    case "code_trace": return renderCodeTrace(block);
    case "diagram": return renderDiagram(block);
    case "legend": return renderLegend(block);
    case "recall_question": return renderRecallQuestion(block);
    case "quiz": return renderQuiz(block);
    case "checklist": return renderChecklist(block);
    case "misconception": return renderMisconception(block);
    case "free_note": return renderFreeNote(block);
    default: return `<!-- unknown block type: ${(block as any).type} -->`;
  }
}

export function generateLessonHtml(lesson: LessonDocument, lessonFileName: string): string {
  const blocksHtml = lesson.blocks.map(renderBlock).join("\n");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(lesson.title)} — Lesson Workbench</title>
<script>(function(){const s=localStorage.getItem('lw-theme');const d=s?s==='dark':matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.classList.toggle('dark',d)})();</script>
<style>${CSS}</style>
</head>
<body>

<div class="bar">
  <div class="sub">lesson-workbench v0.1</div>
  <h1>${esc(lesson.title)}</h1>
  <div class="spacer"></div>
  <button id="themeToggle">Theme</button>
</div>

<div class="sheet">
  ${blocksHtml}

  <div style="text-align:center;padding:20px 0;color:var(--muted);font-family:var(--mono);font-size:11px;">
    <span id="actionCount">0 action(s)</span>
  </div>
</div>

<div class="submit-bar">
  <button id="submitFeedback">Send feedback</button>
  <span id="submitStatus"></span>
</div>

<div id="hlToolbar">
  <button id="hlAnnot">✎ Annotate</button>
</div>

<script>window._lessonFile = ${JSON.stringify(lessonFileName)};</script>
<script>${JS}</script>
</body>
</html>`;
}
