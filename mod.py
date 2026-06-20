#!/usr/bin/env python3
"""
Apply the current Lesson Studio -> StudyForge renderer contract to learn-anything-plugin.

Run from the repository root or from any directory inside it:

  ./mod.py --dry-run
  ./mod.py --dry-run --diff
  ./mod.py
  ./mod.py . --dry-run

Or pass the plugin root explicitly:

  ./mod.py --plugin-root /path/to/learn-anything-plugin --dry-run

What it does:
- Updates Lesson Studio so it receives a page/content spec from upstream and
  renders it through StudyForge-style HTML rules.
- Removes the old fallback where StudyForge/Lesson Studio could invent
  reflections, scenarios, architecture prompts, programming labs, or target
  application context.
- Adds StudyForge renderer references, annotation runtime notes, programming-lab
  rendering rules, an HTML QA checklist, and a lightweight validator.
- Updates Material Forge, Orchestrator, and README wording when those files exist.

No external dependencies. No backup files are created; use git history for rollback.
"""

from __future__ import annotations

import argparse
import difflib
import re
from pathlib import Path


LESSON_STUDIO_SKILL = '''---
name: lesson-studio
description: "use when learn-anything has an upstream lesson-request/page spec and needs a learner-facing StudyForge-style self-contained HTML course, study guide, annotated lesson, interactive practice page, or exam-prep artifact. Lesson Studio renders the provided spec through StudyForge HTML rules; it does not choose curriculum, add exercise types, invent reflection prompts, create programming labs, or infer project/system context."
---

# Lesson Studio

Act as the learn-anything renderer wrapper around StudyForge HTML generation.

Lesson Studio does **not** design the lesson from scratch. It receives a concrete lesson request from upstream learn-anything components, normalizes that request into a compact page spec, and renders one self-contained StudyForge-style HTML artifact using the references in this skill.

## Role Boundary

Lesson Studio owns:

- resolving the active learn-anything workspace;
- reading upstream state and material files needed to render the requested artifact;
- reading `teach/bridge/lesson-request.json` as the source of truth for the artifact;
- normalizing the request into a compact page spec;
- rendering one self-contained HTML artifact under `teach/courses/`;
- adding StudyForge runtime features requested by the spec: annotations, local persistence, export/import, quiz/check behavior, and exam-prep behavior;
- writing `teach/bridge/lesson-result.json`.

Lesson Studio does not own:

- choosing the curriculum sequence;
- selecting the next task class;
- deciding what the learner has mastered;
- updating `progress.json`;
- updating `knowledge-graph.json`;
- adding section types not present in the request;
- adding reflection prompts, scenarios, architecture prompts, programming labs, or application-to-work prompts unless the request includes them;
- creating a second non-StudyForge HTML renderer.

## Workspace

All state files live in `learn-anything/<skill-slug>/`. Read `learn-anything/active-skill.json` to find the active skill slug.

Learner-facing StudyForge artifacts live under:

```text
learn-anything/<skill-slug>/teach/
  MISSION.md
  GLOSSARY.md
  RESOURCES.md
  NOTES.md
  courses/
  reference/
  bridge/
```

Write generated HTML courses to:

```text
learn-anything/<skill-slug>/teach/courses/000N-<dash-case-topic>.html
```

Do not use `teach/lessons/` as the primary output path for new learner-facing HTML artifacts.

## Required Upstream Request

Before generating learner-facing HTML, require:

```text
learn-anything/<skill-slug>/teach/bridge/lesson-request.json
```

If `lesson-request.json` is missing or does not define a concrete artifact shape, stop and report what upstream component must provide. Do not fill the gap by inventing a default lesson structure.

The request should define, either directly or through equivalent fields:

```json
{
  "topic_id": "...",
  "title": "...",
  "artifact_intent": "course|study-guide|exam-prep|practice-page|reference",
  "scope": ["..."],
  "page_spec": {
    "sections": [
      {
        "id": "...",
        "title": "...",
        "purpose": "...",
        "blocks": [
          { "type": "explanation", "source": "..." },
          { "type": "example", "source": "..." },
          { "type": "quiz", "items": [] }
        ]
      }
    ]
  },
  "runtime": {
    "annotations": true,
    "export_import": true,
    "local_state": true
  },
  "source_grounding": {
    "required": false,
    "citations": []
  }
}
```

`page_spec.sections[*].blocks[*].type` is the authority for content types. Lesson Studio may normalize names and generate HTML mechanics, but it must not add new pedagogical block types on its own.

## Inputs To Read

Read these files only to support the upstream request, not to invent missing artifact content:

1. `learn-anything/active-skill.json` — active skill slug.
2. `learn-anything/<skill-slug>/domain-assessment.json` — learner goal, constraints, identity frame, preferences.
3. `learn-anything/<skill-slug>/learning-plan.json` — planned task classes and sequencing.
4. `learn-anything/<skill-slug>/knowledge-graph.json` — prerequisites, misconceptions, relevant vertices.
5. `learn-anything/<skill-slug>/progress.json` — optional recent-session context.
6. `learn-anything/<skill-slug>/skill-dossier.json` — optional field structure and vetted source context.
7. `learn-anything/<skill-slug>/materials/` — optional worked examples, practice sets, assessments, visuals.
8. `learn-anything/<skill-slug>/notebooklm-manifest.json` and `citations.jsonl` — when source-grounded output is required.

## Request Verification

Before rendering, verify that the request provides:

- artifact type or intent;
- topic/title;
- scope or source material references;
- explicit section list or equivalent page spec;
- explicit interactive blocks if quizzes/checks/reflections/labs are desired;
- explicit source-grounding requirements.

If a content type is absent from the request, do not create that type. For example, no `reflection` block means no reflection prompt; no `programming_lab` block means no lab; no `scenario` block means no scenario analysis.

## StudyForge HTML Rendering

For all learner-facing HTML artifacts, follow:

- `references/studyforge-html-generation.md`
- `references/programming-lab.md` only when the page spec includes a programming lab block
- `references/annotation-runtime.md`
- `references/html-quality-checklist.md`

Pass StudyForge rendering only the compact page spec and grounded support material. StudyForge is the renderer, not the content planner.

## NotebookLM / Source Grounding

NotebookLM is an upstream source provider, not an HTML planner.

For source-grounded lessons, factual explanations, document/book/video references, citations, timestamps, page references, or disputed claims:

1. Read `notebooklm-manifest.json` and `citations.jsonl` when present.
2. Use compact NotebookLM retrieval packs or selected citations as source material.
3. Insert citations, timestamps, page references, and deep links directly into the final StudyForge HTML where they support claims.
4. Store only normalized citation metadata and compact source references in durable files.
5. Do not store raw NotebookLM answers, raw subtitle text, raw chapter dumps, or large copied source text.
6. If required NotebookLM grounding is missing or unavailable, stop and report the gap.

## Output

Always write:

```text
learn-anything/<skill-slug>/teach/courses/000N-<dash-case-topic>.html
learn-anything/<skill-slug>/teach/bridge/lesson-result.json
```

`lesson-result.json` should include:

```json
{
  "topic_id": "...",
  "artifact_type": "studyforge-html-course",
  "html_path": "teach/courses/000N-topic.html",
  "reference_paths": [],
  "glossary_terms_added": [],
  "suggested_questions": [],
  "suggested_drills": [],
  "observed_risks": [],
  "citations_used": [],
  "annotation_enabled": true,
  "state_key": "studyforge:<course-id>:state",
  "export_supported": true,
  "import_supported": true
}
```

## Quality Checklist

Before finalizing:

1. Verify the artifact is a self-contained HTML file.
2. Verify the file opens directly in a browser.
3. Verify there is no build step and no framework dependency.
4. Verify the visible content follows the upstream page spec.
5. Verify no extra reflection/scenario/lab/application-context blocks were added.
6. Verify substantive source-grounded claims include citations when required.
7. Verify requested quiz, exam-prep, reveal, or practice interactions work.
8. Verify annotation controls work when requested.
9. Verify local state persists through reload when requested.
10. Verify export/import controls are inside a separate learner menu, not a floating overlay.
11. Run `scripts/validate_studyforge_html.py <html-file>` when available.

## Hard Rules

- Do not update `progress.json`.
- Do not update `knowledge-graph.json`.
- Do not decide that a topic is mastered.
- Do not choose the next curriculum step independently.
- Do not create a separate StudyForge skill.
- Do not maintain duplicate non-StudyForge HTML-generation rules inside Lesson Studio.
- Do not require a separate data model as the source of truth for the HTML artifact.

## Handoff

After writing the artifact, summarize:

- what HTML artifact was created;
- where it was saved;
- which upstream request and materials were used;
- whether citations were included;
- whether annotations and persistence are enabled;
- whether any requested blocks could not be rendered.

Then hand control back to:

- Material Forge when generating material packages;
- Training Conductor when preparing or running a session.
'''


STUDYFORGE_HTML_GENERATION = '''# StudyForge HTML Generation

Render one self-contained StudyForge-style HTML artifact from the compact page spec prepared by Lesson Studio.

## Renderer Boundary

StudyForge HTML generation is a renderer. It does not decide the lesson plan.

It may choose implementation details such as HTML tags, CSS layout, stable IDs, localStorage wiring, annotation runtime wiring, and responsive behavior.

It must not choose content types. Do not add sections, reflection prompts, scenario analysis, architecture prompts, programming labs, application-to-work prompts, exam sections, or final drills unless the page spec includes them.

## Required Input

Expect Lesson Studio to provide a compact page spec with:

- topic and title;
- artifact intent;
- ordered sections;
- ordered blocks inside each section;
- source material or generated text for each substantive block;
- requested interactions;
- requested runtime capabilities;
- source-grounding requirements;
- citations, timestamps, page references, or links when available.

If ordered sections or block types are missing, stop and report that the upstream page spec is incomplete.

## Supported Block Types

Render only block types present in the page spec. Supported examples include:

- `opening`
- `objective`
- `explanation`
- `example`
- `typical_mistake`
- `note`
- `worked_example`
- `guided_practice`
- `quiz`
- `fill_blank`
- `reveal_check`
- `self_explanation`
- `reflection`
- `scenario`
- `programming_lab`
- `exam_check`
- `summary`
- `next_steps`

These are renderable types, not defaults.

## Page Structure

Use this DOM shape unless the page spec explicitly requests a compatible variant:

```text
body
└── .layout
    ├── aside.sidebar
    │   ├── .brand
    │   ├── .subtitle
    │   ├── .progress-shell
    │   └── nav/ol.toc
    └── main.content
        ├── #sfLearnerTools.sf-learner-menu
        ├── section.hero or first content section
        ├── section.section-card[data-section]
        ├── optional section.exam-card
        └── #sfAnnotationToolbar outside main or at end of body
```

## Learner Tools Menu

Render learner tools as a separate menu, not as an overlay and not as a sticky bar over content.

Required IDs:

```html
<div id="sfLearnerTools" class="sf-learner-menu" aria-label="Инструменты курса">
  <button type="button" id="sfLearnerMenuToggle" aria-expanded="false" aria-controls="sfLearnerMenuPanel">Инструменты курса</button>
  <div id="sfLearnerMenuPanel" hidden>
    <span id="sfSaveStatus">Сохранено локально</span>
    <button type="button" id="sfExportState">Экспорт заметок</button>
    <label for="sfImportState" class="sf-import-label">Импорт заметок</label>
    <input id="sfImportState" type="file" accept="application/json" hidden>
    <button type="button" id="sfResetState">Очистить сохранённое</button>
  </div>
</div>
```

CSS for `.sf-learner-menu` must not use `position: fixed`, `position: sticky`, or `position: absolute`.

## Russian Wording

For Russian learner-facing UI, avoid calques and awkward labels.

Prefer:

- `Пример`
- `Типичная ошибка`
- `На что обратить внимание`
- `Важное замечание`
- `Проверка понимания`
- `Практика`

Do not use `Ловушка` as a standard block label. Use `Типичная ошибка` or `На что обратить внимание`.

## Programming Labs

Only render programming labs when the page spec includes a `programming_lab` block. Then follow `references/programming-lab.md`.

## Interactivity

Render interactive elements only when requested by the page spec. Store learner answers and UI state in localStorage when runtime.local_state is enabled.

## Persistence

When local state is requested, use browser `localStorage` to store:

- annotations;
- quiz answers;
- exam answers;
- completed checks;
- learner-edited code;
- expanded/collapsed UI state when present.

Use the state key format:

```text
studyforge:<course-id>:state
```

## Annotation Support

Follow `annotation-runtime.md` when annotations are requested.

The generated HTML must include:

- annotatable content blocks;
- annotation toolbar;
- export/import controls in the learner tools menu;
- reload restoration.

## Source Handling

When citations are provided, place them inline near supported claims. Do not dump an unused bibliography.

If source-grounding is required and no usable citations are available, stop and report the missing source pack.

## HTML Constraints

- Use plain HTML, CSS, and JavaScript.
- Do not require a build step.
- Do not require a server.
- Do not use external frameworks.
- Prefer inline SVG for small explanatory visuals.
- Keep CSS responsive and readable on mobile.
- Ensure the page remains readable if JavaScript fails.
'''


PROGRAMMING_LAB = '''# Programming Lab Rendering

Use this reference only when the Lesson Studio page spec includes a `programming_lab` block.

## Renderer Boundary

This file describes how to render a provided programming lab. It does not authorize adding a lab because the topic is programming-related.

The page spec must provide the lab intent, language, editable code, checks, hints, and any filename needed for local verification.

## Editable Code Rule

When the lab asks the learner to fix, complete, refactor, or inspect code, the relevant code must be editable directly in the HTML lesson.

Do not use the old "virtual source file" UI pattern. Do not show labels like:

```text
Виртуальный файл: VisibilityFlagExercise.java
Virtual file: VisibilityFlagExercise.java
```

A filename may appear only as a local verification instruction, for example:

```text
Для локальной проверки сохраните отредактированный код как VisibilityFlagExercise.java.
```

## Required Editable Code Lab Shape

Use an editable code panel rather than a read-only source block plus a separate answer box.

```html
<div class="code-lab-card" data-lab-id="lab-01-01">
  <h3>Лабораторная: Bug Hunt — остановка рабочего потока</h3>
  <p class="sf-annotatable" data-sf-block="lab-01-01-goal">Найдите и исправьте ошибку видимости.</p>

  <label for="lab-01-01-code">Исправьте код</label>
  <textarea id="lab-01-01-code" class="code-editor" data-sf-answer="lab-01-01-code" spellcheck="false">public class VisibilityFlagExercise {
    private static boolean running = true;
    // ...
  }</textarea>

  <details data-lab-id="lab-01-01" data-hint="L1"><summary>Подсказка 1</summary><p>Концептуальная подсказка без готового решения.</p></details>
  <details data-lab-id="lab-01-01" data-hint="L2"><summary>Подсказка 2</summary><p>Структура решения без полного кода.</p></details>
  <details><summary>Проверка</summary><pre><code>javac VisibilityFlagExercise.java && java VisibilityFlagExercise</code></pre></details>
</div>
```

The code in the `<textarea>` is the editable working copy. Persist it through the StudyForge state object and include it in export/import.

## Read-only Code Blocks

Read-only `<pre><code>` blocks are allowed only for:

- test commands;
- expected output;
- short reference fragments;
- logs;
- acceptance criteria;
- non-editable examples outside a lab.

For Bug Hunt, the buggy code must be editable. Do not ask the learner to write a corrected fragment in a separate answer field while the buggy code remains read-only.

## Hints

Use only hints provided by the page spec. If hint levels are provided, render them as closed reveal blocks. Do not invent extra hint levels.

## Verification

Render verification commands, expected output, or browser checks only when provided by the page spec. Browser-side heuristic checks are allowed only if explicitly requested.

## State Persistence Requirements

The StudyForge state object must preserve programming-lab data:

```js
{
  answers: {
    "lab-01-01-code": "learner edited code here"
  },
  codeLabs: {
    "lab-01-01": {
      "hintsOpened": ["L1", "L2"],
      "checkResult": "pending|passed|failed",
      "mastery": "not-rated|weak|ok|mastered"
    }
  }
}
```
'''


ANNOTATION_RUNTIME = '''# Annotation Runtime

Add selection-based learner annotations to StudyForge-generated HTML when the page spec requests annotations.

## DOM Hooks

Mark meaningful content blocks as annotatable:

```html
<p class="sf-annotatable" data-sf-block="section-01-p1">...</p>
```

The `data-sf-block` value must be stable within the generated HTML file.

Do not make controls annotatable:

```text
button
input
textarea
select
.sf-learner-menu
.sf-modal
.quiz-option
.exam-option
```

## Required UI

Include this toolbar near the end of `<body>` when annotations are enabled:

```html
<div id="sfAnnotationToolbar" class="sf-annotation-toolbar" hidden>
  <button type="button" id="sfAnnotateBtn">Аннотировать</button>
</div>
```

The toolbar must contain only the annotate action. It must hide on Escape, outside click, new selection, annotation save, or cancelled/empty prompt.

## Stored State

Store annotation state in `localStorage` under:

```text
studyforge:<course-id>:state
```

Use visible-text offsets, not `innerHTML` offsets.

## Required Features

The generated page must support:

- annotate selected text;
- edit annotation note;
- restore annotations after reload;
- export notes as JSON;
- import notes from JSON;
- clear notes;
- avoid overlapping annotation ranges within the same block.

## Boundaries

- Do not write annotations into `progress.json`.
- Do not treat annotations as mastery evidence.
- Do not send annotations externally.
- Do not require a server.
- Do not break quiz or exam interactions.
'''


HTML_QUALITY_CHECKLIST = '''# HTML Quality Checklist

Use this checklist before finalizing any StudyForge-generated HTML artifact.

## File

- The output is one `.html` file.
- It is written under `teach/courses/`.
- It opens directly in a browser.
- It does not require a build step.
- It does not require a server.
- It does not depend on external frameworks.

## Page Spec Fidelity

- The visible sections match the upstream `page_spec` order.
- Block types match the upstream `page_spec`.
- No reflection block is present unless requested.
- No scenario block is present unless requested.
- No programming lab is present unless requested.
- No exam/check section is present unless requested.
- No extra project/system/application/team context is introduced outside provided source material.

## Learning Design

- The learner can tell what the requested artifact is for.
- The explanation is scoped to the current request.
- Examples and typical mistakes appear only when requested or provided in source material.
- Interactive checks match the requested interactions.

## Sources

- Source-grounded claims use inline citations when required.
- Citations are tied to specific claims.
- No raw NotebookLM answer dump is embedded.
- No unused bibliography bloat is added.

## Runtime

- Requested quiz/check interactions work.
- Requested annotation controls work.
- Notes export works.
- Notes import works.
- localStorage restore works after reload.
- Learner tools are in a separate menu, not a sticky/fixed overlay.
- The page remains readable if JavaScript fails.

## System Boundaries

- The HTML does not update `progress.json`.
- The HTML does not update `knowledge-graph.json`.
- The HTML does not claim mastery.
- `lesson-result.json` points to the generated HTML and runtime features.
'''


VALIDATOR = r'''#!/usr/bin/env python3
"""Lightweight QA for StudyForge HTML rendered by Lesson Studio."""

from __future__ import annotations

import argparse
import re
from html.parser import HTMLParser
from pathlib import Path


class Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.stack: list[str] = []
        self.attrs_stack: list[dict[str, str]] = []
        self.visible_parts: list[str] = []
        self.textareas: list[dict[str, str]] = []
        self.current_textarea: dict[str, str] | None = None
        self.learner_tools_attrs: dict[str, str] | None = None
        self.ids: set[str] = set()
        self.details_open_with_solution: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {k: v or "" for k, v in attrs}
        self.stack.append(tag)
        self.attrs_stack.append(attr)
        if "id" in attr:
            self.ids.add(attr["id"])
        if attr.get("id") == "sfLearnerTools":
            self.learner_tools_attrs = attr
        if tag == "textarea":
            self.current_textarea = dict(attr)
            self.current_textarea["__text__"] = ""
        if tag == "details" and "open" in attr:
            self.details_open_with_solution.append("open-details")

    def handle_endtag(self, tag: str) -> None:
        if tag == "textarea" and self.current_textarea is not None:
            self.textareas.append(self.current_textarea)
            self.current_textarea = None
        if self.stack:
            self.stack.pop()
        if self.attrs_stack:
            self.attrs_stack.pop()

    def handle_data(self, data: str) -> None:
        if self.current_textarea is not None:
            self.current_textarea["__text__"] += data
            return
        if any(tag in {"script", "style"} for tag in self.stack):
            return
        self.visible_parts.append(data)


def validate(path: Path) -> list[str]:
    html = path.read_text(encoding="utf-8")
    parser = Parser()
    parser.feed(html)
    visible = " ".join(" ".join(parser.visible_parts).split())
    errors: list[str] = []

    required_ids = {
        "sfLearnerTools",
        "sfLearnerMenuToggle",
        "sfLearnerMenuPanel",
        "sfSaveStatus",
        "sfExportState",
        "sfImportState",
        "sfResetState",
    }
    missing = sorted(required_ids - parser.ids)
    if missing:
        errors.append("missing learner tools menu ids: " + ", ".join(missing))

    css = re.sub(r"/\*.*?\*/", "", html, flags=re.DOTALL)
    if re.search(r"\.sf-learner-(?:tools|menu)[^{]*{[^}]*position\s*:\s*(fixed|sticky|absolute)", css, re.I | re.S):
        errors.append("learner tools menu must not be fixed/sticky/absolute overlay")

    if re.search(r"Виртуальный\s+файл\s*:|Virtual\s+file\s*:", visible, re.I):
        errors.append("old virtual-file UI label is visible")

    if re.search(r"Правильный\s+ответ\s*:", visible, re.I):
        errors.append("correct answer is visible in initial UI")

    if re.search(r"bug\s+hunt|исправьте\s+код|найдите\s+и\s+исправьте|лабораторная", visible, re.I):
        has_code_textarea = any(
            "code" in (ta.get("class", "") + " " + ta.get("id", "") + " " + ta.get("data-sf-answer", "")).lower()
            and len(ta.get("__text__", "")) > 40
            for ta in parser.textareas
        )
        if not has_code_textarea:
            errors.append("lab appears to ask for code fixing but no editable code textarea was found")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate StudyForge HTML generated by Lesson Studio")
    parser.add_argument("html_file", type=Path)
    args = parser.parse_args()

    errors = validate(args.html_file)
    if errors:
        print(f"FAIL: {args.html_file}")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"PASS: {args.html_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''


MATERIAL_FORGE_SECTION = '''### 2b. StudyForge HTML Artifact Request Layer

For each task class that needs a learner-facing explanation artifact, create or update `teach/bridge/lesson-request.json` and invoke **Lesson Studio**.

Material Forge owns the artifact request. Lesson Studio renders that request through StudyForge-style HTML rules.

1. Create or update `teach/bridge/lesson-request.json` with:
   - topic / task-class scope
   - learner goal and identity framing
   - must-cover misconceptions, prerequisites, and transfer targets
   - explicit ordered section list or `page_spec`
   - explicit block types: examples, checks, reflections, scenarios, labs, exam prep, summaries, next steps
   - references to relevant worked examples, practice sets, assessments, visuals, and source packs
   - whether the artifact needs source grounding, citations, exam prep, annotations, or an interactive study guide
2. Invoke **Lesson Studio** to render the request as a StudyForge-style self-contained HTML artifact under `teach/courses/`.
3. Lesson Studio owns:
   - HTML rendering
   - annotation runtime
   - localStorage persistence
   - notes export/import
   - requested quiz/check/exam-prep interactivity
   - final `teach/bridge/lesson-result.json`
4. Keep authority boundaries clean:
   - Material Forge decides what learner-facing artifact is needed
   - Material Forge supplies the content plan / page spec
   - Lesson Studio renders the supplied page spec
   - StudyForge rules provide HTML/runtime mechanics
   - Material Forge must not duplicate HTML structure, annotation behavior, quiz UI, or progress runtime
   - Training Conductor remains the only owner of progress/mastery updates

'''


def find_plugin_root(start: Path) -> Path:
    start = start.resolve()
    candidates: list[Path] = []

    for p in [start, *start.parents]:
        candidates.append(p)
        candidates.append(p / "learn-anything-plugin")

    if start.exists() and start.is_dir():
        for marker in start.rglob("skills/lesson-studio/SKILL.md"):
            candidates.append(marker.parent.parent.parent)

    seen: set[Path] = set()
    valid: list[Path] = []
    for c in candidates:
        c = c.resolve()
        if c in seen:
            continue
        seen.add(c)
        if (c / "skills" / "lesson-studio" / "SKILL.md").exists():
            valid.append(c)

    if not valid:
        raise SystemExit(
            "Could not find learn-anything-plugin. Run this script from inside the learn repo "
            "or pass --plugin-root /path/to/learn-anything-plugin."
        )

    valid.sort(key=lambda p: (0 if p.name == "learn-anything-plugin" else 1, len(str(p))))
    return valid[0]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str, dry_run: bool, changed: list[Path], show_diff: bool) -> None:
    old = path.read_text(encoding="utf-8") if path.exists() else None
    if old == text:
        return
    if dry_run:
        print(f"[dry-run] would write {path}")
        if show_diff and old is not None:
            diff = difflib.unified_diff(
                old.splitlines(), text.splitlines(), fromfile=str(path), tofile=str(path) + " (new)", lineterm=""
            )
            print("\n".join(diff))
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    changed.append(path)


def replace_between(text: str, start_marker: str, end_marker: str, replacement: str) -> tuple[str, bool]:
    start = text.find(start_marker)
    if start == -1:
        return text, False
    end = text.find(end_marker, start + len(start_marker))
    if end == -1:
        return text, False
    return text[:start] + replacement + text[end:], True


def update_material_forge(path: Path) -> str:
    text = read_text(path)
    markers = [
        "### 2b. Teach-style HTML Lesson Layer",
        "### 2b. StudyForge HTML Artifact Layer",
        "### 2b. StudyForge HTML Artifact Request Layer",
    ]
    for marker in markers:
        updated, ok = replace_between(text, marker, "### 3. Productive Failure Scenarios", MATERIAL_FORGE_SECTION)
        if ok:
            return updated
    if MATERIAL_FORGE_SECTION.strip() not in text:
        return text.rstrip() + "\n\n" + MATERIAL_FORGE_SECTION
    return text


def update_orchestrator(path: Path) -> str:
    text = read_text(path)
    text = text.replace(
        "7. **Lesson Studio** (skill: `lesson-studio`) — Teach-style HTML lessons, reference pages, glossary updates, mission-grounded explanation artifacts",
        "7. **Lesson Studio** (skill: `lesson-studio`) — Renders upstream lesson-request/page specs as StudyForge-style annotated self-contained HTML artifacts",
    )
    text = text.replace("│   │   ├── lessons/", "│   │   ├── courses/")
    text = text.replace(
        "ELIF user asks for an explanation artifact / \"explain the current topic\" / \"make me a lesson\" / \"generate a reference page\":\n  -> ROUTE to Lesson Studio\n  -> Then route back to Training Conductor if the request is part of an active session",
        "ELIF user asks for an explanation artifact / lesson / course / study guide / exam prep / annotated HTML / interactive HTML:\n  -> Ensure Material Forge or Training Conductor has written teach/bridge/lesson-request.json\n  -> ROUTE to Lesson Studio to render that request under teach/courses/\n  -> Then route back to Training Conductor if the request is part of an active session",
    )
    text = text.replace(
        "Lesson Studio writes learner-facing HTML artifacts under `teach/` but does NOT update mastery or progress.",
        "Lesson Studio renders upstream lesson requests as learner-facing StudyForge-style HTML artifacts under `teach/courses/` but does NOT update mastery or progress.",
    )
    return text


def update_readme(path: Path) -> str:
    text = read_text(path)
    text = text.replace(
        "- **Teach-style lesson artifacts** — Lesson Studio creates beautiful self-contained HTML lessons, reference pages, and glossary-driven explanations inside the active skill workspace",
        "- **StudyForge HTML artifacts** — Lesson Studio renders upstream lesson requests/page specs into annotated self-contained HTML courses, study guides, exam-prep pages, reference pages, and glossary-driven explanations inside the active skill workspace",
    )
    text = text.replace(
        "| `lesson-studio` | Teach-style HTML lessons, quick-reference pages, glossary updates, and mission-grounded explanation artifacts |",
        "| `lesson-studio` | Renders upstream lesson-request/page specs as StudyForge-style annotated self-contained HTML courses, study guides, exam-prep pages, quick-reference pages, glossary updates, and mission-grounded explanation artifacts |",
    )
    return text


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply Lesson Studio -> StudyForge renderer contract to learn-anything-plugin.")
    parser.add_argument("path", nargs="?", type=Path, default=None, help="Repository root or plugin root. Default: current directory.")
    parser.add_argument("--plugin-root", type=Path, default=None, help="Path to learn-anything-plugin.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing files.")
    parser.add_argument("--diff", action="store_true", help="Show unified diffs during dry run.")
    args = parser.parse_args()

    base = args.plugin_root or args.path or Path.cwd()
    plugin = args.plugin_root.resolve() if args.plugin_root else find_plugin_root(base)
    if not (plugin / "skills" / "lesson-studio" / "SKILL.md").exists():
        raise SystemExit(f"Invalid plugin root: {plugin}")

    changed: list[Path] = []

    lesson_dir = plugin / "skills" / "lesson-studio"
    refs = lesson_dir / "references"
    scripts = lesson_dir / "scripts"

    targets = {
        lesson_dir / "SKILL.md": LESSON_STUDIO_SKILL,
        refs / "studyforge-html-generation.md": STUDYFORGE_HTML_GENERATION,
        refs / "programming-lab.md": PROGRAMMING_LAB,
        refs / "annotation-runtime.md": ANNOTATION_RUNTIME,
        refs / "html-quality-checklist.md": HTML_QUALITY_CHECKLIST,
        scripts / "validate_studyforge_html.py": VALIDATOR,
    }

    for path, text in targets.items():
        write_text(path, text, args.dry_run, changed, args.diff)

    obsolete_paths = [
        refs / "annotations.md",
        refs / "studyforge-annotations.js",
        refs / "lesson-json-contract.md",
        refs / "standard-lesson-mode.md",
        refs / "studyforge-course-mode.md",
        refs / "html-render-contract.md",
        refs / "exam-prep-blocks.md",
    ]
    for obsolete in obsolete_paths:
        if obsolete.exists():
            if args.dry_run:
                print(f"[dry-run] would delete obsolete {obsolete}")
            else:
                obsolete.unlink()
                changed.append(obsolete)

    material = plugin / "skills" / "material-forge" / "SKILL.md"
    if material.exists():
        write_text(material, update_material_forge(material), args.dry_run, changed, args.diff)
    else:
        print(f"[warn] missing {material}")

    orchestrator = plugin / "skills" / "orchestrator" / "SKILL.md"
    if orchestrator.exists():
        write_text(orchestrator, update_orchestrator(orchestrator), args.dry_run, changed, args.diff)
    else:
        print(f"[warn] missing {orchestrator}")

    readme = plugin / "README.md"
    if readme.exists():
        write_text(readme, update_readme(readme), args.dry_run, changed, args.diff)
    else:
        print(f"[warn] missing {readme}")

    if args.dry_run:
        print(f"Dry run complete. Plugin root: {plugin}")
        return 0

    print(f"Lesson Studio -> StudyForge renderer contract applied in: {plugin}")
    if changed:
        print("Changed files:")
        for p in changed:
            print(f"- {p.relative_to(plugin)}")
    else:
        print("No file changes were needed.")

    print("\nNext checks:")
    print("- Review git diff")
    print("- Confirm Material Forge writes teach/bridge/lesson-request.json with page_spec")
    print("- Confirm Lesson Studio renders only the supplied page_spec")
    print("- Confirm Lesson Studio writes StudyForge HTML under teach/courses/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

