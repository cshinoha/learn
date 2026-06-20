# StudyForge HTML Generation

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
