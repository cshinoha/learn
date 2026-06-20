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
- The opening connects the topic to the learner's mission when mission context exists.
- The explanation is scoped to the current request.
- The page includes examples.
- The page includes typical mistakes or misconceptions when useful.
- The page includes interactive checks.
- Exam-prep requests include exam-style practice.
- The page does not assume the learner has a system, project, service, application, team, company, or codebase unless upstream context provides one.

## UI Answer Leakage

- Placeholders are neutral.
- Correct answers are not visible in the initial UI.
- Explanations that reveal answers are hidden until attempt/submission/reveal.
- Solution details are not open by default.
- First-level hints do not reveal the exact answer.

## Programming Labs

- No learner-facing `Виртуальный файл:` / `Virtual file:` labels.
- Bug Hunt code is editable directly.
- Read-only code blocks are not used as the only copy of code that must be fixed.
- Local filenames appear only in verification instructions.

## Learner Tools Menu

- Export/import/reset controls exist.
- Controls are inside a separate menu.
- The learner tools container is not sticky, fixed, absolute, or overlaying content.

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

## Deterministic Check

Run when available:

```bash
python3 skills/lesson-studio/scripts/validate_studyforge_html.py learn-anything/<skill-slug>/teach/courses/<file>.html
```
