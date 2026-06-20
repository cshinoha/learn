---
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
