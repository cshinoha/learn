---
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
