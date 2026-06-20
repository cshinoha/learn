# Annotation Runtime

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
