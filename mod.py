#!/usr/bin/env python3
"""
Apply the current StudyForge/Lesson Studio contract to learn-anything-plugin.

Run from the repository root or from any directory inside it:

  ./mod.py --dry-run
  ./mod.py
  ./mod.py . --dry-run

Or pass the plugin root explicitly:

  ./mod.py --plugin-root /path/to/learn-anything-plugin --dry-run

What it does:
- Updates Lesson Studio so it wraps StudyForge-style HTML generation instead of
  owning a separate lesson renderer.
- Adds/updates StudyForge generation references, programming-lab rules,
  annotation rules, and HTML QA checks.
- Adds a deterministic HTML validator for UI answer leaks, assumed context,
  obsolete virtual-file labels, and overlay learner tools.
- Updates Material Forge, Orchestrator, and README wording when those files exist.

No external dependencies.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import difflib
import re
import shutil
import sys
from pathlib import Path


LESSON_STUDIO_SKILL = """---
name: lesson-studio
description: "use when learn-anything needs a learner-facing studyforge-style self-contained html course, study guide, annotated lesson, interactive practice page, or exam-prep artifact. wraps StudyForge HTML generation using upstream lesson-request context, source materials, NotebookLM citation packs when required, and learn-anything workspace state. never chooses curriculum independently, never updates mastery, and never invents project/system context."
---

# Lesson Studio

Act as the learn-anything wrapper around StudyForge HTML generation.

Lesson Studio does not own curriculum selection. It receives the artifact request, scope, constraints, learner context, and content plan from upstream learn-anything components. It prepares a compact generation context and follows `references/studyforge-html-generation.md` to create one self-contained StudyForge-style HTML artifact.

## Role Boundary

Lesson Studio owns:

- resolving the active learn-anything workspace;
- reading upstream state and material files;
- using `teach/bridge/lesson-request.json` as the source of truth when present;
- preparing a compact generation context for StudyForge-style HTML generation;
- generating one self-contained HTML artifact under `teach/courses/`;
- adding selected-text annotations, local persistence, export/import, quizzes, checks, and exam-prep behavior through the generated HTML;
- updating teaching support files such as `teach/GLOSSARY.md`, `teach/RESOURCES.md`, and `teach/NOTES.md` only when useful and grounded;
- writing `teach/bridge/lesson-result.json`.

Lesson Studio does not own:

- choosing the curriculum sequence;
- deciding what the learner has mastered;
- updating `progress.json`;
- updating `knowledge-graph.json`;
- inventing that the learner has a system, project, application, service, team, company, production codebase, or architecture;
- implementing a second HTML layout separate from StudyForge;
- duplicating annotation or quiz mechanics outside the StudyForge generation references.

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

## Inputs

Before generating, read:

1. `learn-anything/active-skill.json` — active skill slug.
2. `learn-anything/<skill-slug>/domain-assessment.json` — learner goal, constraints, identity frame, preferences.
3. `learn-anything/<skill-slug>/learning-plan.json` — planned task classes, sequencing, current curricular context.
4. `learn-anything/<skill-slug>/knowledge-graph.json` — prerequisites, misconceptions, relevant vertices, learner overlay.
5. `learn-anything/<skill-slug>/progress.json` — optional current session context and recent confusion points.
6. `learn-anything/<skill-slug>/skill-dossier.json` — optional field structure and vetted source context.
7. `learn-anything/<skill-slug>/materials/` — optional worked examples, practice sets, assessments, visuals, and other generated material.
8. `learn-anything/<skill-slug>/teach/bridge/lesson-request.json` — preferred concrete request from Material Forge or Training Conductor.
9. `learn-anything/<skill-slug>/notebooklm-manifest.json` and `citations.jsonl` — when source-grounded output is required.

## Input Verification

Before proceeding, verify:

- `active-skill.json` exists and contains `active`.
- `domain-assessment.json` exists and contains learner purpose or equivalent learner context.
- `learning-plan.json` exists and contains a curriculum or task-class structure.
- `knowledge-graph.json` exists and contains graph or vertex information.

If upstream scope is ambiguous, report the missing context instead of inventing a curriculum step.

## Source of Truth

`teach/bridge/lesson-request.json`, when present, is the source of truth for:

- topic and scope;
- section types;
- exercise types;
- reflection prompts;
- scenarios;
- target context;
- programming labs;
- exam requirements;
- source-grounding requirements.

If the request does not include a system, project, application, service, team, production codebase, or architecture, do not mention or assume one. Use neutral study phrasing instead.

## Scope Selection

Prefer `teach/bridge/lesson-request.json` when present. It should define the concrete artifact request: topic, task-class scope, must-cover items, misconceptions, practice targets, citation requirements, and artifact intent.

If no request exists, infer only the immediate artifact scope from:

- `progress.json` current session agenda or recent confusion;
- the current task class in `learning-plan.json`;
- low-mastery or misconception-prone vertices in `knowledge-graph.json`.

Do not choose the next curriculum step independently. If the needed scope cannot be inferred, route back to Training Conductor or Material Forge.

## NotebookLM / Source Grounding

NotebookLM is an upstream source provider, not an HTML generator.

For source-grounded lessons, factual explanations, document/book/video references, citations, timestamps, page references, or disputed claims:

1. Read `notebooklm-manifest.json` and `citations.jsonl` when present.
2. Use compact NotebookLM retrieval packs or selected citations as source material.
3. Insert citations, timestamps, page references, and deep links directly into the final StudyForge HTML where they support claims.
4. Store only normalized citation metadata and compact source references in durable files.
5. Do not store raw NotebookLM answers, raw subtitle text, raw chapter dumps, or large copied source text.
6. If required NotebookLM grounding is missing or unavailable, stop and report the gap rather than silently substituting parametric knowledge.

## StudyForge HTML Generation

For all learner-facing HTML artifacts, follow:

- `references/studyforge-html-generation.md`
- `references/programming-lab.md` when a programming lab is explicitly requested
- `references/annotation-runtime.md`
- `references/html-quality-checklist.md`

Lesson Studio should pass StudyForge a compact generation context containing only upstream-provided or directly grounded data:

- topic and title;
- learner mission and constraints;
- current task-class scope;
- prerequisites;
- misconceptions;
- worked examples and practice targets;
- source-grounding requirements;
- citations and source links when available;
- relevant glossary terms;
- requested follow-up drills.

StudyForge then generates one self-contained HTML file directly.

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
4. Verify the course uses upstream learner context without inventing missing context.
5. Verify substantive source-grounded claims include citations when required.
6. Verify quiz, exam-prep, reveal, or practice interactions work.
7. Verify annotation controls work.
8. Verify local state persists through reload.
9. Verify export/import controls exist inside a separate learner menu, not a floating overlay.
10. Run `scripts/validate_studyforge_html.py <html-file>` when available.

## Hard Rules

- Do not update `progress.json`.
- Do not update `knowledge-graph.json`.
- Do not decide that a topic is mastered.
- Do not choose the next curriculum step independently.
- Do not create a separate StudyForge skill.
- Do not maintain duplicate non-StudyForge HTML-generation rules inside Lesson Studio.
- Do not require a separate data model as the source of truth for the HTML artifact.
- Do not assume an existing system/project/application/service/team/codebase unless provided by upstream context.

## Handoff

After writing the artifact, summarize:

- what HTML course was created;
- where it was saved;
- which upstream materials were used;
- whether citations were included;
- whether annotations and persistence are enabled;
- what questions or drills the Training Conductor should use next.

Then hand control back to:

- Material Forge when generating material packages;
- Training Conductor when preparing or running a session.
"""


STUDYFORGE_HTML_GENERATION = """# StudyForge HTML Generation

Generate one self-contained StudyForge-style HTML course or lesson page from the compact generation context prepared by Lesson Studio.

## Input Context

Expect Lesson Studio to provide:

- topic and title;
- learner goal and mission framing;
- current task-class scope;
- prerequisites;
- misconceptions or typical mistakes;
- worked examples and practice targets;
- relevant generated materials;
- source-grounding requirements;
- citations, timestamps, page references, or links when available;
- glossary terms and related references;
- explicit section, exercise, reflection, scenario, lab, or assessment requirements.

Do not choose the curriculum. Use the scope provided by Lesson Studio.

## Content Source Boundary

Lesson Studio or the user's input is the source of truth for lesson content types and context.

Do not infer that the learner has an existing system, project, application, service, team, company, production codebase, or architecture unless the input explicitly says so.

Do not add reflection prompts, architecture prompts, scenario analysis, application-to-work prompts, or programming labs by default. Add them only when the compact generation context requests them or when they are directly necessary to teach the supplied material.

Forbidden initial UI phrases unless the context explicitly provides such an object:

- `в вашей системе`
- `в вашем проекте`
- `в вашем приложении`
- `в вашем сервисе`
- `в вашей команде`
- `your system`
- `your project`
- `your application`
- `your service`
- `your team`

Use neutral alternatives:

- `в учебном примере`
- `в этом фрагменте кода`
- `в похожем сценарии`
- `в реальном проекте, если он у вас есть`
- `в заданном контексте`

## Output

Write one self-contained HTML file to:

```text
teach/courses/000N-<dash-case-topic>.html
```

The HTML is the source of truth for the generated learner-facing artifact.

## Course Shape

Use a StudyForge-style sequence. Adapt section count to scope, but prefer:

1. Opening / mission grounding
2. What the learner will be able to do
3. Prerequisite check or quick anchor
4. Core explanation
5. Worked example
6. Typical mistakes or misconceptions
7. Guided practice
8. Quiz or knowledge check
9. Exam-style checks when relevant
10. Final summary
11. Next steps or suggested drills when requested by upstream context

This is a pedagogical structure, not a fixed schema.

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

## Subject Adaptation

Use subject adaptations only when requested by the Lesson Studio context or necessary for the provided material.

Programming:
- include code examples, trace exercises, debugging prompts, and run/compile checks only when useful and requested by scope.

Science and math:
- include formulas, units, worked examples, and misconception checks.

Humanities:
- include comparisons, timelines, source interpretation, and argument analysis.

Law and business:
- include cases, scenarios, principle application, and borderline examples only when the context asks for them.

Languages:
- include vocabulary, grammar patterns, translation checks, and short production tasks.

## Interactivity

Include at least two meaningful interactive elements when scope allows:

- reveal checks;
- quiz questions;
- exam-style prompts;
- self-explanation prompts;
- guided completion;
- misconception checks;
- checklist completion.

Reflection prompts are not a default. Include them only when supplied or explicitly requested by upstream context.

For exam-prep artifacts, include a final mixed check or practice exam section.

## Answer Visibility Policy

Use `source-visible-ui-hidden`.

Answers may exist in HTML source, JavaScript, data attributes, embedded keys, or validation rules. They must not be visible in the initial learner interface before an attempt, explicit hint reveal, exam submission, or explicit "Show solution" action.

Forbidden in visible initial UI:

- answer-like placeholders;
- visible `Correct answer` / `Правильный ответ` explanations;
- visible solution code;
- pre-opened solution details;
- first-level hints that contain the final answer;
- scaffold code that already contains the TODO solution.

Allowed in source:

- `data-correct` attributes;
- answer arrays;
- JavaScript answer keys;
- regex-based self-check rules;
- hidden explanations;
- hidden solution details.

Textarea and input placeholders must be neutral, for example `Введите ваш ответ` or `Исправьте код здесь`.

## Learner Tools Menu

Export/import/reset controls must live in a separate learner tools menu. They must not float over the content and must not use `position: sticky`, `position: fixed`, or `position: absolute` for the menu container.

Required IDs:

```html
<div id="sfLearnerTools" class="sf-learner-tools" aria-label="Инструменты курса">
  <button type="button" id="sfLearnerMenuToggle" aria-expanded="false" aria-controls="sfLearnerMenuPanel">Инструменты курса</button>
  <div id="sfLearnerMenuPanel" class="sf-learner-menu" hidden>
    <span id="sfSaveStatus">Сохранено локально</span>
    <button type="button" id="sfExportState">Экспорт заметок</button>
    <label for="sfImportState" class="sf-import-label">Импорт заметок</label>
    <input id="sfImportState" type="file" accept="application/json" hidden>
    <button type="button" id="sfResetState">Очистить сохранённое</button>
  </div>
</div>
```

## Persistence

Use browser `localStorage` to store:

- annotations;
- quiz answers;
- exam answers;
- completed checks;
- code answers when code-editing labs are present;
- last visited section;
- expanded/collapsed UI state when present.

Use the state key format:

```text
studyforge:<course-id>:state
```

## Annotation Support

Follow `annotation-runtime.md`.

The generated HTML must include:

- annotatable content sections;
- an Annotate control;
- Export notes;
- Import notes;
- Clear notes;
- reload restoration.

## Source Handling

When citations are provided, place them inline near supported claims. Do not dump a bibliography that is not used in the lesson.

If the output is source-grounded and no usable citations are available, stop and report the missing source pack.

## HTML Constraints

- Use plain HTML, CSS, and JavaScript.
- Do not require a build step.
- Do not require a server.
- Do not use external frameworks.
- Prefer inline SVG for small explanatory visuals.
- Keep CSS responsive and readable on mobile.
- Ensure the page remains readable if JavaScript fails.
"""


PROGRAMMING_LAB = """# Programming Lab Mode

Use this reference only when the Lesson Studio generation context explicitly requests a programming lab or supplies lab requirements.

## Source of Truth

Do not create programming labs merely because the topic is programming-related. Labs, lab type, scenario, target language, and code context must come from Lesson Studio, the user's request, or provided study material.

Do not infer an existing learner system, project, service, application, team, or codebase unless it is explicitly provided.

## Goal

Create embedded programming practice inside the same StudyForge HTML file. The learner must edit the relevant code directly in the HTML lesson.

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

## Exercise Patterns

Use only exercise patterns requested by the upstream context.

### Bug Hunt

Show editable buggy code. The learner changes the code directly.

Use for:
- null handling;
- integer overflow;
- off-by-one errors;
- concurrency mistakes;
- resource leaks;
- wrong equality or hashing behavior.

Required HTML adaptation:
- show the buggy code in an editable code textarea;
- preserve learner edits;
- show edge-case tests, commands, or expected output;
- use hints that do not reveal the exact answer at level 1.

### Implement from Spec

Use an editable method body, class, or function area. Provide specification and tests.

### Fill in the Scaffold

Use editable code with TODO markers inside the textarea.

### Refactor and Optimize

Use editable code. Ask the learner to preserve behavior while improving readability, design, performance, or memory usage.

### Architecture Challenge

Use only when explicitly requested by Lesson Studio context. Do not invent architecture prompts.

## Hint Ladder

Use staged help:

- L1 Conceptual: ask a guiding question about the concept.
- L2 Structural: provide pseudocode or steps in natural language.
- L3 Fragment: show one small code pattern or line, not the full function.
- Full solution: only after L3 is insufficient or the learner explicitly requests it.

Avoid saying exactly which line to paste unless the learner asks for the answer.

## Verification Before Completion

When the learner says an exercise is finished or asks whether it is correct:

1. Identify the relevant code lab and editable code field.
2. Ask for or inspect compiler/test/runtime output when possible.
3. If browser-side checks are implemented, run or use them before judging.
4. Only then say whether it passes.
5. If it fails, ask one guiding debugging question before giving a full correction.

Do not claim correctness from visual inspection alone when verification output is available.

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

Export/import must include code answers, hint state, check results, and mastery state.
"""


ANNOTATION_RUNTIME = """# Annotation Runtime

Add selection-based learner annotations to StudyForge-generated HTML.

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
.sf-toolbar
.sf-modal
.quiz-option
.exam-option
#sfLearnerTools
#sfAnnotationToolbar
```

## Stored State

Store annotation state in `localStorage` under:

```text
studyforge:<course-id>:state
```

Suggested state shape:

```json
{
  "schema": "studyforge-state-v1",
  "courseId": "...",
  "updatedAt": "...",
  "annotations": [
    {
      "id": "ann-001",
      "blockId": "section-1-p1",
      "start": 120,
      "end": 153,
      "selectedText": "selected visible text",
      "prefix": "...",
      "suffix": "...",
      "note": "learner note",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "answers": {},
  "choices": {},
  "exam": {},
  "codeLabs": {},
  "ui": {}
}
```

## Offset Rule

Calculate offsets against the visible text of the nearest `.sf-annotatable[data-sf-block]` block, not against `innerHTML` and not against the full document.

## Required Features

The generated page must support:

- annotate selected text;
- edit annotation note;
- restore annotations after reload;
- export notes as JSON;
- import notes from JSON;
- clear notes;
- avoid obvious overlapping annotation ranges within the same block.

## Boundaries

- Do not write annotations into `progress.json`.
- Do not treat annotations as mastery evidence.
- Do not send annotations externally.
- Do not require a server.
- Do not break quiz or exam interactions.
"""


HTML_QUALITY_CHECKLIST = """# HTML Quality Checklist

Use this checklist before finalizing any StudyForge-generated HTML artifact.

## File

- The output is one `.html` file.
- It is written under `teach/courses/`.
- It opens directly in a browser.
- It does not require a build step.
- It does not require a server.
- It does not depend on external frameworks.

## Learning Design

- The learner can tell what they will be able to do after the page.
- The opening connects the topic to the learner's mission when mission context exists.
- The explanation is scoped to the current request.
- The page includes examples.
- The page includes typical mistakes or misconceptions when useful.
- The page includes interactive checks.
- Exam-prep requests include exam-style practice.
- The page does not assume the learner has a system, project, service, application, team, company, or codebase unless upstream context provides one.

## UI Answer Leakage

- Placeholders are neutral.
- Correct answers are not visible in the initial UI.
- Explanations that reveal answers are hidden until attempt/submission/reveal.
- Solution details are not open by default.
- First-level hints do not reveal the exact answer.

## Programming Labs

- No learner-facing `Виртуальный файл:` / `Virtual file:` labels.
- Bug Hunt code is editable directly.
- Read-only code blocks are not used as the only copy of code that must be fixed.
- Local filenames appear only in verification instructions.

## Learner Tools Menu

- Export/import/reset controls exist.
- Controls are inside a separate menu.
- The learner tools container is not sticky, fixed, absolute, or overlaying content.

## Sources

- Source-grounded claims use inline citations when required.
- Citations are tied to specific claims.
- No raw NotebookLM answer dump is embedded.
- No unused bibliography bloat is added.

## Runtime

- Quiz/check interactions work.
- Annotation controls work.
- Notes export works.
- Notes import works.
- localStorage restore works after reload.
- The page remains readable if JavaScript fails.

## System Boundaries

- The HTML does not update `progress.json`.
- The HTML does not update `knowledge-graph.json`.
- The HTML does not claim mastery.
- `lesson-result.json` points to the generated HTML and runtime features.

## Deterministic Check

Run when available:

```bash
python3 skills/lesson-studio/scripts/validate_studyforge_html.py learn-anything/<skill-slug>/teach/courses/<file>.html
```
"""


VALIDATE_STUDYFORGE_HTML = r'''#!/usr/bin/env python3
"""Validate StudyForge-style HTML for Lesson Studio UI contracts.

This is a lightweight static check. It intentionally checks generated HTML,
not source secrecy: answers may exist in source, but must not be visible in the
initial learner interface.
"""

from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


ASSUMED_CONTEXT_PATTERNS = [
    r"\bв\s+вашей\s+системе\b",
    r"\bв\s+вашем\s+проекте\b",
    r"\bв\s+вашем\s+приложении\b",
    r"\bв\s+вашем\s+сервисе\b",
    r"\bв\s+вашей\s+команде\b",
    r"\byour\s+system\b",
    r"\byour\s+project\b",
    r"\byour\s+application\b",
    r"\byour\s+service\b",
    r"\byour\s+team\b",
]

VIRTUAL_FILE_PATTERNS = [
    r"\bВиртуальный\s+файл\s*:",
    r"\bVirtual\s+file\s*:",
]

ANSWER_PLACEHOLDER_PATTERNS = [
    r"\bjoin\s*\(",
    r"\bvolatile\b",
    r"\bsynchronized\b",
    r"\bAtomicInteger\b",
    r"\bCompletableFuture\b",
    r"\bnotifyAll\s*\(",
    r"\bsignalAll\s*\(",
    r"->",
    r";",
]

VISIBLE_ANSWER_PATTERNS = [
    r"Правильный\s+ответ\s*:",
    r"Correct\s+answer\s*:",
]


class StudyForgeHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.errors: list[str] = []
        self.stack: list[tuple[str, dict[str, str]]] = []
        self.in_hidden_depth = 0
        self.text_visible: list[str] = []
        self.textareas: list[dict[str, str]] = []
        self.learner_tools_found = False
        self.learner_menu_toggle_found = False
        self.learner_menu_panel_found = False
        self.learner_tools_style = ""
        self.current_textarea: dict[str, str] | None = None
        self.current_textarea_text: list[str] = []

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        attrs = {k.lower(): (v or "") for k, v in attrs_list}
        self.stack.append((tag, attrs))

        hidden = "hidden" in attrs or attrs.get("aria-hidden") == "true" or "display:none" in attrs.get("style", "").replace(" ", "").lower()
        if hidden:
            self.in_hidden_depth += 1

        if attrs.get("id") == "sfLearnerTools":
            self.learner_tools_found = True
            self.learner_tools_style = attrs.get("style", "")
        if attrs.get("id") == "sfLearnerMenuToggle":
            self.learner_menu_toggle_found = True
        if attrs.get("id") == "sfLearnerMenuPanel":
            self.learner_menu_panel_found = True

        if tag in {"input", "textarea"}:
            placeholder = attrs.get("placeholder", "")
            for pattern in ANSWER_PLACEHOLDER_PATTERNS:
                if re.search(pattern, placeholder, re.IGNORECASE):
                    self.errors.append(f"answer-like placeholder in <{tag}>: {placeholder!r}")

        if tag == "details" and "open" in attrs:
            self.errors.append("<details open> found; solution/reveal blocks must not be open initially")

        if tag == "textarea":
            self.current_textarea = attrs
            self.current_textarea_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "textarea" and self.current_textarea is not None:
            text = "".join(self.current_textarea_text)
            data = dict(self.current_textarea)
            data["__text__"] = text
            self.textareas.append(data)
            self.current_textarea = None
            self.current_textarea_text = []

        if self.stack:
            start_tag, attrs = self.stack.pop()
            hidden = "hidden" in attrs or attrs.get("aria-hidden") == "true" or "display:none" in attrs.get("style", "").replace(" ", "").lower()
            if hidden and self.in_hidden_depth > 0:
                self.in_hidden_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.current_textarea is not None:
            self.current_textarea_text.append(data)
            return
        if self.in_hidden_depth == 0:
            self.text_visible.append(data)


def validate(path: Path) -> list[str]:
    html = path.read_text(encoding="utf-8", errors="replace")
    parser = StudyForgeHTMLParser()
    parser.feed(html)
    errors = list(parser.errors)

    visible = " ".join(parser.text_visible)
    visible = re.sub(r"\s+", " ", visible)

    for pattern in ASSUMED_CONTEXT_PATTERNS:
        if re.search(pattern, visible, re.IGNORECASE):
            errors.append(f"assumed learner context visible in UI: /{pattern}/")

    for pattern in VIRTUAL_FILE_PATTERNS:
        if re.search(pattern, visible, re.IGNORECASE):
            errors.append(f"obsolete virtual-file label visible in UI: /{pattern}/")

    for pattern in VISIBLE_ANSWER_PATTERNS:
        if re.search(pattern, visible, re.IGNORECASE):
            errors.append(f"visible answer reveal in initial UI: /{pattern}/")

    if not parser.learner_tools_found:
        errors.append("missing #sfLearnerTools")
    if not parser.learner_menu_toggle_found:
        errors.append("missing #sfLearnerMenuToggle")
    if not parser.learner_menu_panel_found:
        errors.append("missing #sfLearnerMenuPanel")

    css_scan = html.lower()
    overlay_patterns = [
        r"#sflearnertools\s*\{[^}]*position\s*:\s*(fixed|sticky|absolute)",
        r"\.sf-learner-tools\s*\{[^}]*position\s*:\s*(fixed|sticky|absolute)",
    ]
    for pattern in overlay_patterns:
        if re.search(pattern, css_scan, re.DOTALL):
            errors.append("learner tools menu uses overlay positioning; use normal document flow")

    inline_style = parser.learner_tools_style.lower()
    if re.search(r"position\s*:\s*(fixed|sticky|absolute)", inline_style):
        errors.append("#sfLearnerTools inline style uses overlay positioning")

    # Bug Hunt heuristic: if the visible text asks to fix code, require at least one code-like textarea.
    if re.search(r"bug\s+hunt|исправьте\s+код|найдите\s+и\s+исправьте|лабораторная", visible, re.IGNORECASE):
        has_code_textarea = any(
            ("code" in (ta.get("class", "") + " " + ta.get("id", "") + " " + ta.get("data-sf-answer", "")).lower())
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


MATERIAL_FORGE_SECTION = """### 2b. StudyForge HTML Artifact Layer

For each task class that needs a learner-facing explanation artifact, create or update `teach/bridge/lesson-request.json` and invoke **Lesson Studio**.

Lesson Studio is the learn-anything wrapper around StudyForge HTML generation. It receives upstream materials, prepares the generation context, and uses StudyForge-style rules to produce the final self-contained HTML artifact.

1. Create or update `teach/bridge/lesson-request.json` with:
   - topic / task-class scope
   - learner goal and identity framing
   - must-cover misconceptions, prerequisites, and transfer targets
   - requested section types, exercise types, reflections, scenarios, labs, and assessments
   - references to relevant worked examples, practice sets, assessments, visuals, and source packs
   - whether the artifact needs source grounding, citations, exam prep, or an annotated study guide
2. Invoke **Lesson Studio** to generate a StudyForge-style self-contained HTML artifact under `teach/courses/`.
3. Lesson Studio owns:
   - HTML generation
   - annotation runtime
   - localStorage persistence
   - notes export/import
   - quiz and exam-prep interactivity
   - final `teach/bridge/lesson-result.json`
4. Keep authority boundaries clean:
   - Material Forge decides what material is needed
   - Lesson Studio prepares the generation context and wraps StudyForge generation
   - Lesson Studio must not invent missing project/system context
   - Material Forge must not duplicate HTML structure, annotation behavior, quiz UI, or progress runtime
   - Training Conductor remains the only owner of progress/mastery updates

"""


def now_stamp() -> str:
    return _dt.datetime.now().strftime("%Y%m%d-%H%M%S")


def find_plugin_root(start: Path) -> Path:
    start = start.resolve()
    candidates: list[Path] = []

    # Direct path or parents.
    for p in [start, *start.parents]:
        candidates.append(p)
        candidates.append(p / "learn-anything-plugin")

    # Common case: script launched from repository root that contains the plugin directory.
    for p in start.rglob("skills/lesson-studio/SKILL.md") if start.exists() and start.is_dir() else []:
        if ".git" in p.parts or "node_modules" in p.parts:
            continue
        candidates.append(p.parents[2])

    seen: set[Path] = set()
    valid: list[Path] = []
    for c in candidates:
        try:
            c = c.resolve()
        except OSError:
            continue
        if c in seen:
            continue
        seen.add(c)
        if (c / "skills" / "lesson-studio" / "SKILL.md").exists():
            valid.append(c)

    if len(valid) == 1:
        return valid[0]
    if len(valid) > 1:
        preferred = [p for p in valid if p.name == "learn-anything-plugin"]
        if len(preferred) == 1:
            return preferred[0]
        msg = "Multiple learn-anything-plugin roots found. Pass --plugin-root explicitly:\n"
        msg += "\n".join(f"  - {p}" for p in valid)
        raise SystemExit(msg)

    raise SystemExit(
        "Could not find learn-anything-plugin. Run this script from inside the learn repo "
        "or pass --plugin-root /path/to/learn-anything-plugin."
    )


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str, dry_run: bool, backups: bool, changed: list[Path], show_diff: bool = False) -> None:
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
        elif show_diff:
            print(f"--- /dev/null\n+++ {path}\n" + text)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    if backups and old is not None:
        backup = path.with_suffix(path.suffix + f".bak-{now_stamp()}")
        shutil.copy2(path, backup)
    path.write_text(text, encoding="utf-8")
    if path.suffix == ".py":
        try:
            path.chmod(path.stat().st_mode | 0o755)
        except OSError:
            pass
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
    replacements = {
        "7. **Lesson Studio** (skill: `lesson-studio`) — Teach-style HTML lessons, reference pages, glossary updates, mission-grounded explanation artifacts":
        "7. **Lesson Studio** (skill: `lesson-studio`) — Wraps StudyForge HTML generation to create annotated self-contained HTML courses, reference pages, glossary updates, and mission-grounded explanation artifacts",
        "│   │   ├── lessons/":
        "│   │   ├── courses/",
        "Training Conductor may invoke Lesson Studio if the session needs a learner-facing HTML lesson or refreshed reference artifact":
        "Training Conductor may invoke Lesson Studio if the session needs a learner-facing StudyForge-style HTML course, annotated lesson, exam-prep artifact, or refreshed reference artifact",
        "Lesson Studio writes learner-facing HTML artifacts under `teach/` but does NOT update mastery or progress.":
        "Lesson Studio writes StudyForge-style learner-facing HTML artifacts under `teach/courses/` but does NOT update mastery or progress.",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    route_old = (
        "ELIF user asks for an explanation artifact / \"explain the current topic\" / \"make me a lesson\" / \"generate a reference page\":\n"
        "  -> ROUTE to Lesson Studio\n"
        "  -> Then route back to Training Conductor if the request is part of an active session"
    )
    route_new = (
        "ELIF user asks for an explanation artifact / lesson / course / study guide / exam prep / annotated HTML / interactive HTML / \"make me a lesson\" / \"generate a reference page\":\n"
        "  -> ROUTE to Lesson Studio\n"
        "  -> Lesson Studio wraps StudyForge HTML generation and writes the artifact under teach/courses/\n"
        "  -> Then route back to Training Conductor if the request is part of an active session"
    )
    text = text.replace(route_old, route_new)
    return text


def update_readme(path: Path) -> str:
    text = read_text(path)
    replacements = {
        "- **Teach-style lesson artifacts** — Lesson Studio creates beautiful self-contained HTML lessons, reference pages, and glossary-driven explanations inside the active skill workspace":
        "- **StudyForge HTML artifacts** — Lesson Studio wraps StudyForge generation to create annotated self-contained HTML courses, study guides, exam-prep pages, reference pages, and glossary-driven explanations inside the active skill workspace",
        "| `lesson-studio` | Teach-style HTML lessons, quick-reference pages, glossary updates, and mission-grounded explanation artifacts |":
        "| `lesson-studio` | Wraps StudyForge HTML generation to create annotated self-contained HTML courses, study guides, exam-prep pages, quick-reference pages, glossary updates, and mission-grounded explanation artifacts |",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply current StudyForge/Lesson Studio integration to learn-anything-plugin.")
    parser.add_argument("path", nargs="?", type=Path, default=None, help="Repository root, learn-anything-plugin path, or any directory inside the repository. Default: current directory.")
    parser.add_argument("--plugin-root", type=Path, default=None, help="Path to learn-anything-plugin. Overrides positional path and auto-detection.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing files.")
    parser.add_argument("--diff", action="store_true", help="With --dry-run, print unified diffs for changed text files.")
    parser.add_argument("--no-backup", action="store_true", help="Do not create .bak timestamp backups before overwriting existing files.")
    args = parser.parse_args()

    start_path = args.path.resolve() if args.path else Path.cwd()
    plugin = args.plugin_root.resolve() if args.plugin_root else find_plugin_root(start_path)
    if not (plugin / "skills" / "lesson-studio" / "SKILL.md").exists():
        raise SystemExit(f"Invalid plugin root: {plugin}")

    changed: list[Path] = []
    backups = not args.no_backup

    lesson_dir = plugin / "skills" / "lesson-studio"
    refs = lesson_dir / "references"
    scripts = lesson_dir / "scripts"

    targets = {
        lesson_dir / "SKILL.md": LESSON_STUDIO_SKILL,
        refs / "studyforge-html-generation.md": STUDYFORGE_HTML_GENERATION,
        refs / "programming-lab.md": PROGRAMMING_LAB,
        refs / "annotation-runtime.md": ANNOTATION_RUNTIME,
        refs / "html-quality-checklist.md": HTML_QUALITY_CHECKLIST,
        scripts / "validate_studyforge_html.py": VALIDATE_STUDYFORGE_HTML,
    }

    for path, text in targets.items():
        write_text(path, text, args.dry_run, backups, changed, show_diff=args.diff)

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
                if backups:
                    backup = obsolete.with_suffix(obsolete.suffix + f".bak-{now_stamp()}")
                    shutil.copy2(obsolete, backup)
                obsolete.unlink()
                changed.append(obsolete)

    material = plugin / "skills" / "material-forge" / "SKILL.md"
    if material.exists():
        write_text(material, update_material_forge(material), args.dry_run, backups, changed, show_diff=args.diff)
    else:
        print(f"[warn] missing {material}")

    orchestrator = plugin / "skills" / "orchestrator" / "SKILL.md"
    if orchestrator.exists():
        write_text(orchestrator, update_orchestrator(orchestrator), args.dry_run, backups, changed, show_diff=args.diff)
    else:
        print(f"[warn] missing {orchestrator}")

    readme = plugin / "README.md"
    if readme.exists():
        write_text(readme, update_readme(readme), args.dry_run, backups, changed, show_diff=args.diff)
    else:
        print(f"[warn] missing {readme}")

    if args.dry_run:
        print("Dry run complete.")
        return 0

    print(f"StudyForge/Lesson Studio integration applied in: {plugin}")
    if changed:
        print("Changed files:")
        for p in changed:
            print(f"- {p.relative_to(plugin)}")
    else:
        print("No file changes were needed.")

    print("\nNext checks:")
    print("- Review git diff")
    print("- Confirm Lesson Studio writes StudyForge HTML under teach/courses/")
    print("- Run: python3 skills/lesson-studio/scripts/validate_studyforge_html.py <generated-html>")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

