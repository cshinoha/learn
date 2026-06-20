# HTML Quality Checklist

Use this checklist before finalizing any StudyForge-generated HTML artifact.

## File

- The output is one `.html` file.
- It is written under `teach/courses/`.
- It opens directly in a browser.
- It does not require a build step.
- It does not require a server.
- It does not depend on external frameworks.

## Page Spec Fidelity

- The visible sections match the upstream `page_spec` order.
- Block types match the upstream `page_spec`.
- No reflection block is present unless requested.
- No scenario block is present unless requested.
- No programming lab is present unless requested.
- No exam/check section is present unless requested.
- No extra project/system/application/team context is introduced outside provided source material.

## Learning Design

- The learner can tell what the requested artifact is for.
- The explanation is scoped to the current request.
- Examples and typical mistakes appear only when requested or provided in source material.
- Interactive checks match the requested interactions.

## Sources

- Source-grounded claims use inline citations when required.
- Citations are tied to specific claims.
- No raw NotebookLM answer dump is embedded.
- No unused bibliography bloat is added.

## Runtime

- Requested quiz/check interactions work.
- Requested annotation controls work.
- Notes export works.
- Notes import works.
- localStorage restore works after reload.
- Learner tools are in a separate menu, not a sticky/fixed overlay.
- The page remains readable if JavaScript fails.

## System Boundaries

- The HTML does not update `progress.json`.
- The HTML does not update `knowledge-graph.json`.
- The HTML does not claim mastery.
- `lesson-result.json` points to the generated HTML and runtime features.
