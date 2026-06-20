---
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
