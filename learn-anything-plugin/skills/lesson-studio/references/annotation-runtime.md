# Annotation Runtime

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
