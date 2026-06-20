# StudyForge HTML Generation

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
