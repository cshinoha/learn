# StudyForge HTML Generation

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
