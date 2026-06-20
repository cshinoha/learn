#!/usr/bin/env python3
"""
Apply StudyForge -> Lesson Studio integration to learn-anything-plugin.

Run from inside the pinned learn repository, for example:

  cd learn-master
  python3 apply_studyforge_lesson_studio.py

What it does:
- Replaces Lesson Studio's duplicated HTML lesson-generation logic with a StudyForge HTML-generation wrapper.
- Adds Lesson Studio reference files for StudyForge HTML generation, annotations, and HTML QA.
- Updates Material Forge so it requests Lesson Studio artifacts without duplicating HTML behavior.
- Updates Orchestrator routing and component descriptions.
- Updates learn-anything-plugin/README.md.

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
description: "use when learn-anything needs a learner-facing studyforge-style self-contained html course, study guide, annotated lesson, or exam-prep artifact. wraps StudyForge HTML generation using upstream learn-anything state, source materials, NotebookLM citation packs when required, and lesson-request context. never updates mastery state or chooses curriculum independently."
---

# Lesson Studio

Act as the learn-anything wrapper around StudyForge HTML generation.

Lesson Studio does not own curriculum selection. It receives materials and scope from upstream learn-anything components, prepares the generation context, invokes the StudyForge-style HTML generation process described in `references/studyforge-html-generation.md`, and writes the final handoff metadata.

## Role Boundary

Lesson Studio owns:

- resolving the active learn-anything workspace;
- reading upstream state and material files;
- using `teach/bridge/lesson-request.json` when present;
- preparing a compact generation context for StudyForge;
- generating one self-contained StudyForge-style HTML artifact;
- adding annotation, persistence, export/import, quiz, and exam-prep behavior through the StudyForge HTML output;
- updating teaching support files such as `teach/GLOSSARY.md`, `teach/RESOURCES.md`, and `teach/NOTES.md` when useful;
- writing `teach/bridge/lesson-result.json`.

Lesson Studio does not own:

- choosing the curriculum sequence;
- deciding what the learner has mastered;
- updating `progress.json`;
- updating `knowledge-graph.json`;
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
- `references/annotation-runtime.md`
- `references/html-quality-checklist.md`

Lesson Studio should pass StudyForge a compact generation context containing:

- topic and title;
- learner mission and constraints;
- current task-class scope;
- prerequisites;
- misconceptions;
- worked examples and practice targets;
- source-grounding requirements;
- citations and source links when available;
- relevant glossary terms;
- suggested follow-up drills.

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

Before finalizing, verify:

1. The artifact is a self-contained HTML file.
2. The file opens directly in a browser.
3. There is no build step and no framework dependency.
4. The course is mission-grounded and uses upstream learner context.
5. Substantive source-grounded claims include citations when required.
6. Quiz, exam-prep, reveal, or practice interactions work.
7. Annotation controls work.
8. Local state persists through reload.
9. Export/import notes controls exist.
10. The artifact is useful without the chat transcript.

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
- misconceptions and likely traps;
- worked examples and practice targets;
- relevant generated materials;
- source-grounding requirements;
- citations, timestamps, page references, or links when available;
- glossary terms and related references.

Do not choose the curriculum. Use the scope provided by Lesson Studio.

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
6. Common mistakes or misconceptions
7. Guided practice
8. Quiz or knowledge check
9. Exam-style checks when relevant
10. Final summary
11. Next steps or suggested drills

This is a pedagogical structure, not a fixed schema.

## Subject Adaptation

Programming:
- include code examples, trace exercises, debugging prompts, and run/compile checks when useful.

Science and math:
- include formulas, units, worked examples, and misconception checks.

Humanities:
- include comparisons, timelines, source interpretation, and argument analysis.

Law and business:
- include cases, scenarios, principle application, and borderline examples.

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
- checklist completion;
- reflection prompts.

For exam-prep artifacts, include a final mixed check or practice exam section.

## Persistence

Use browser `localStorage` to store:

- annotations;
- quiz answers;
- exam answers;
- completed checks;
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


ANNOTATION_RUNTIME = """# Annotation Runtime

Add selection-based learner annotations to StudyForge-generated HTML.

## DOM Hooks

Mark large content sections as annotatable:

```html
<section class="sf-annotatable" data-sf-section="section-1">
  ...
</section>
```

The `data-sf-section` value must be stable within the generated HTML file.

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
      "sectionId": "section-1",
      "start": 120,
      "end": 153,
      "text": "selected visible text",
      "note": "learner note",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "quizAnswers": {},
  "examAnswers": {},
  "completedChecks": [],
  "ui": {}
}
```

## Offset Rule

Calculate offsets against the visible text of the nearest `.sf-annotatable` section, not against the full HTML document.

## Required Features

The generated page must support:

- annotate selected text;
- edit annotation note;
- restore annotations after reload;
- export notes as JSON;
- import notes from JSON;
- clear notes;
- avoid obvious overlapping annotation ranges within the same section.

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
- The opening connects the topic to the learner's mission.
- The explanation is scoped to the current request.
- The page includes examples.
- The page includes common mistakes or misconceptions when useful.
- The page includes interactive checks.
- Exam-prep requests include exam-style practice.

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
"""


MATERIAL_FORGE_SECTION = """### 2b. StudyForge HTML Artifact Layer

For each task class that needs a learner-facing explanation artifact, create or update `teach/bridge/lesson-request.json` and invoke **Lesson Studio**.

Lesson Studio is the learn-anything wrapper around StudyForge HTML generation. It receives upstream materials, prepares the generation context, and uses StudyForge to produce the final self-contained HTML artifact.

1. Create or update `teach/bridge/lesson-request.json` with:
   - topic / task-class scope
   - learner goal and identity framing
   - must-cover misconceptions, prerequisites, and transfer targets
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
   - Lesson Studio prepares the generation context and wraps StudyForge
   - StudyForge generates the HTML
   - Material Forge must not duplicate HTML structure, annotation behavior, quiz UI, or progress runtime
   - Training Conductor remains the only owner of progress/mastery updates

"""


def now_stamp() -> str:
    return _dt.datetime.now().strftime("%Y%m%d-%H%M%S")


def find_plugin_root(start: Path) -> Path:
    start = start.resolve()
    candidates = []
    for p in [start, *start.parents]:
        candidates.append(p / "learn-anything-plugin")
        if p.name == "learn-anything-plugin":
            candidates.append(p)
    for c in candidates:
        if (c / "skills" / "lesson-studio" / "SKILL.md").exists():
            return c
    raise SystemExit(
        "Could not find learn-anything-plugin. Run this script from inside the learn repo "
        "or pass --plugin-root /path/to/learn-anything-plugin."
    )


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str, dry_run: bool, backups: bool, changed: list[Path]) -> None:
    old = path.read_text(encoding="utf-8") if path.exists() else None
    if old == text:
        return
    if dry_run:
        print(f"[dry-run] would write {path}")
        if old is not None:
            diff = difflib.unified_diff(
                old.splitlines(), text.splitlines(), fromfile=str(path), tofile=str(path) + " (new)", lineterm=""
            )
            print("\n".join(diff))
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    if backups and old is not None:
        backup = path.with_suffix(path.suffix + f".bak-{now_stamp()}")
        shutil.copy2(path, backup)
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


def replace_or_append(text: str, old: str, new: str, append_heading: str | None = None) -> tuple[str, bool]:
    if old in text:
        return text.replace(old, new), True
    if new in text:
        return text, False
    if append_heading:
        return text.rstrip() + "\n\n" + append_heading + "\n\n" + new.strip() + "\n", True
    return text, False


def update_material_forge(path: Path) -> str:
    text = read_text(path)
    updated, ok = replace_between(
        text,
        "### 2b. Teach-style HTML Lesson Layer",
        "### 3. Productive Failure Scenarios",
        MATERIAL_FORGE_SECTION,
    )
    if not ok:
        updated, ok = replace_between(
            text,
            "### 2b. StudyForge HTML Artifact Layer",
            "### 3. Productive Failure Scenarios",
            MATERIAL_FORGE_SECTION,
        )
    if not ok and MATERIAL_FORGE_SECTION.strip() not in text:
        updated = text.rstrip() + "\n\n" + MATERIAL_FORGE_SECTION
    return updated


def update_orchestrator(path: Path) -> str:
    text = read_text(path)
    text = text.replace(
        "7. **Lesson Studio** (skill: `lesson-studio`) — Teach-style HTML lessons, reference pages, glossary updates, mission-grounded explanation artifacts",
        "7. **Lesson Studio** (skill: `lesson-studio`) — Wraps StudyForge HTML generation to create annotated self-contained HTML courses, reference pages, glossary updates, and mission-grounded explanation artifacts",
    )
    text = text.replace(
        "│   │   ├── lessons/",
        "│   │   ├── courses/",
    )
    text = text.replace(
        "ELIF user asks for an explanation artifact / \"explain the current topic\" / \"make me a lesson\" / \"generate a reference page\":\n  -> ROUTE to Lesson Studio\n  -> Then route back to Training Conductor if the request is part of an active session",
        "ELIF user asks for an explanation artifact / lesson / course / study guide / exam prep / annotated HTML / interactive HTML / \"make me a lesson\" / \"generate a reference page\":\n  -> ROUTE to Lesson Studio\n  -> Lesson Studio wraps StudyForge HTML generation and writes the artifact under teach/courses/\n  -> Then route back to Training Conductor if the request is part of an active session",
    )
    text = text.replace(
        "Training Conductor may invoke Lesson Studio if the session needs a learner-facing HTML lesson or refreshed reference artifact",
        "Training Conductor may invoke Lesson Studio if the session needs a learner-facing StudyForge-style HTML course, annotated lesson, exam-prep artifact, or refreshed reference artifact",
    )
    text = text.replace(
        "Lesson Studio writes learner-facing HTML artifacts under `teach/` but does NOT update mastery or progress.",
        "Lesson Studio writes StudyForge-style learner-facing HTML artifacts under `teach/courses/` but does NOT update mastery or progress.",
    )
    return text


def update_readme(path: Path) -> str:
    text = read_text(path)
    text = text.replace(
        "Training Conductor ──> Lesson Studio\n  (Socratic teaching,     (teach-style HTML lessons,\n   adaptive difficulty,    references, glossary,\n   mastery gates,          mission-grounded explanations)\n   progress tracking)",
        "Training Conductor ──> Lesson Studio\n  (Socratic teaching,     (StudyForge HTML generation,\n   adaptive difficulty,    annotated self-contained courses,\n   mastery gates,          references, glossary,\n   progress tracking)      mission-grounded explanations)",
    )
    text = text.replace(
        "- **Teach-style lesson artifacts** — Lesson Studio creates beautiful self-contained HTML lessons, reference pages, and glossary-driven explanations inside the active skill workspace",
        "- **StudyForge HTML artifacts** — Lesson Studio wraps StudyForge generation to create annotated self-contained HTML courses, study guides, exam-prep pages, reference pages, and glossary-driven explanations inside the active skill workspace",
    )
    text = text.replace(
        "| `lesson-studio` | Teach-style HTML lessons, quick-reference pages, glossary updates, and mission-grounded explanation artifacts |",
        "| `lesson-studio` | Wraps StudyForge HTML generation to create annotated self-contained HTML courses, study guides, exam-prep pages, quick-reference pages, glossary updates, and mission-grounded explanation artifacts |",
    )
    return text


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply StudyForge HTML generation integration to learn-anything-plugin.")
    parser.add_argument("--plugin-root", type=Path, default=None, help="Path to learn-anything-plugin. Default: auto-detect from cwd.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing files.")
    parser.add_argument("--no-backup", action="store_true", help="Do not create .bak timestamp backups before overwriting existing files.")
    args = parser.parse_args()

    plugin = args.plugin_root.resolve() if args.plugin_root else find_plugin_root(Path.cwd())
    if not (plugin / "skills" / "lesson-studio" / "SKILL.md").exists():
        raise SystemExit(f"Invalid plugin root: {plugin}")

    changed: list[Path] = []
    backups = not args.no_backup

    lesson_dir = plugin / "skills" / "lesson-studio"
    refs = lesson_dir / "references"

    targets = {
        lesson_dir / "SKILL.md": LESSON_STUDIO_SKILL,
        refs / "studyforge-html-generation.md": STUDYFORGE_HTML_GENERATION,
        refs / "annotation-runtime.md": ANNOTATION_RUNTIME,
        refs / "html-quality-checklist.md": HTML_QUALITY_CHECKLIST,
    }

    for path, text in targets.items():
        write_text(path, text, args.dry_run, backups, changed)

    # Remove earlier duplicated/obsolete integration artifacts if present.
    # The final design has one embedded annotation contract in annotation-runtime.md;
    # generated HTML should include its own runtime rather than referencing a separate
    # StudyForge runtime asset.
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
        write_text(material, update_material_forge(material), args.dry_run, backups, changed)
    else:
        print(f"[warn] missing {material}")

    orchestrator = plugin / "skills" / "orchestrator" / "SKILL.md"
    if orchestrator.exists():
        write_text(orchestrator, update_orchestrator(orchestrator), args.dry_run, backups, changed)
    else:
        print(f"[warn] missing {orchestrator}")

    readme = plugin / "README.md"
    if readme.exists():
        write_text(readme, update_readme(readme), args.dry_run, backups, changed)
    else:
        print(f"[warn] missing {readme}")

    if args.dry_run:
        print("Dry run complete.")
        return 0

    print(f"StudyForge -> Lesson Studio integration applied in: {plugin}")
    if changed:
        print("Changed files:")
        for p in changed:
            print(f"- {p.relative_to(plugin)}")
    else:
        print("No file changes were needed.")

    print("\nNext checks:")
    print("- Review git diff")
    print("- Confirm no separate studyforge-annotated skill was added")
    print("- Confirm Lesson Studio writes StudyForge HTML under teach/courses/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


