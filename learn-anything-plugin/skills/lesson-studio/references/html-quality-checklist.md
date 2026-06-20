# HTML Quality Checklist

Use this checklist before finalizing any StudyForge-generated HTML artifact.

## File

- The output is one `.html` file.
- It is written under `teach/courses/`.
- It opens directly in a browser.
- It does not require a build step.
- It does not require a server.
- It does not depend on external frameworks.

## Learning Design

- The learner can tell what they will be able to do after the page.
- The opening connects the topic to the learner's mission.
- The explanation is scoped to the current request.
- The page includes examples.
- The page includes common mistakes or misconceptions when useful.
- The page includes interactive checks.
- Exam-prep requests include exam-style practice.

## Sources

- Source-grounded claims use inline citations when required.
- Citations are tied to specific claims.
- No raw NotebookLM answer dump is embedded.
- No unused bibliography bloat is added.

## Runtime

- Quiz/check interactions work.
- Annotation controls work.
- Notes export works.
- Notes import works.
- localStorage restore works after reload.
- The page remains readable if JavaScript fails.

## System Boundaries

- The HTML does not update `progress.json`.
- The HTML does not update `knowledge-graph.json`.
- The HTML does not claim mastery.
- `lesson-result.json` points to the generated HTML and runtime features.
