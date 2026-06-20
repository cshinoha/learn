# Annotation Runtime

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
