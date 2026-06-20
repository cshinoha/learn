# Annotation Layer (StudyForge Unified)

This module enables text-level annotations inside StudyForge-style HTML lessons.

## Behavior
- Users can select text inside `.sf-annotatable[data-sf-block]`
- A toolbar appears with a single action: Annotate
- Annotations are stored in localStorage or host state API

## Data Model
```json
{
  "id": "ann-id",
  "blockId": "section-01",
  "start": 10,
  "end": 50,
  "selectedText": "...",
  "note": "..."
}
```

## Rules
- Must not cross block boundaries
- Must not overlap existing annotations
- Must persist after reload

## Runtime
Provided by `studyforge-annotations.js` embedded into HTML output.
