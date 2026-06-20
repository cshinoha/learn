# Programming Lab Mode

Use this reference only when the Lesson Studio generation context explicitly requests a programming lab or supplies lab requirements.

## Source of Truth

Do not create programming labs merely because the topic is programming-related. Labs, lab type, scenario, target language, and code context must come from Lesson Studio, the user's request, or provided study material.

Do not infer an existing learner system, project, service, application, team, or codebase unless it is explicitly provided.

## Goal

Create embedded programming practice inside the same StudyForge HTML file. The learner must edit the relevant code directly in the HTML lesson.

Do not use the old "virtual source file" UI pattern. Do not show labels like:

```text
Виртуальный файл: VisibilityFlagExercise.java
Virtual file: VisibilityFlagExercise.java
```

A filename may appear only as a local verification instruction, for example:

```text
Для локальной проверки сохраните отредактированный код как VisibilityFlagExercise.java.
```

## Required Editable Code Lab Shape

Use an editable code panel rather than a read-only source block plus a separate answer box.

```html
<div class="code-lab-card" data-lab-id="lab-01-01">
  <h3>Лабораторная: Bug Hunt — остановка рабочего потока</h3>
  <p class="sf-annotatable" data-sf-block="lab-01-01-goal">Найдите и исправьте ошибку видимости.</p>

  <label for="lab-01-01-code">Исправьте код</label>
  <textarea id="lab-01-01-code" class="code-editor" data-sf-answer="lab-01-01-code" spellcheck="false">public class VisibilityFlagExercise {
    private static boolean running = true;
    // ...
  }</textarea>

  <details data-lab-id="lab-01-01" data-hint="L1"><summary>Подсказка 1</summary><p>Концептуальная подсказка без готового решения.</p></details>
  <details data-lab-id="lab-01-01" data-hint="L2"><summary>Подсказка 2</summary><p>Структура решения без полного кода.</p></details>
  <details><summary>Проверка</summary><pre><code>javac VisibilityFlagExercise.java && java VisibilityFlagExercise</code></pre></details>
</div>
```

The code in the `<textarea>` is the editable working copy. Persist it through the StudyForge state object and include it in export/import.

## Read-only Code Blocks

Read-only `<pre><code>` blocks are allowed only for:

- test commands;
- expected output;
- short reference fragments;
- logs;
- acceptance criteria;
- non-editable examples outside a lab.

For Bug Hunt, the buggy code must be editable. Do not ask the learner to write a corrected fragment in a separate answer field while the buggy code remains read-only.

## Exercise Patterns

Use only exercise patterns requested by the upstream context.

### Bug Hunt

Show editable buggy code. The learner changes the code directly.

Use for:
- null handling;
- integer overflow;
- off-by-one errors;
- concurrency mistakes;
- resource leaks;
- wrong equality or hashing behavior.

Required HTML adaptation:
- show the buggy code in an editable code textarea;
- preserve learner edits;
- show edge-case tests, commands, or expected output;
- use hints that do not reveal the exact answer at level 1.

### Implement from Spec

Use an editable method body, class, or function area. Provide specification and tests.

### Fill in the Scaffold

Use editable code with TODO markers inside the textarea.

### Refactor and Optimize

Use editable code. Ask the learner to preserve behavior while improving readability, design, performance, or memory usage.

### Architecture Challenge

Use only when explicitly requested by Lesson Studio context. Do not invent architecture prompts.

## Hint Ladder

Use staged help:

- L1 Conceptual: ask a guiding question about the concept.
- L2 Structural: provide pseudocode or steps in natural language.
- L3 Fragment: show one small code pattern or line, not the full function.
- Full solution: only after L3 is insufficient or the learner explicitly requests it.

Avoid saying exactly which line to paste unless the learner asks for the answer.

## Verification Before Completion

When the learner says an exercise is finished or asks whether it is correct:

1. Identify the relevant code lab and editable code field.
2. Ask for or inspect compiler/test/runtime output when possible.
3. If browser-side checks are implemented, run or use them before judging.
4. Only then say whether it passes.
5. If it fails, ask one guiding debugging question before giving a full correction.

Do not claim correctness from visual inspection alone when verification output is available.

## State Persistence Requirements

The StudyForge state object must preserve programming-lab data:

```js
{
  answers: {
    "lab-01-01-code": "learner edited code here"
  },
  codeLabs: {
    "lab-01-01": {
      "hintsOpened": ["L1", "L2"],
      "checkResult": "pending|passed|failed",
      "mastery": "not-rated|weak|ok|mastered"
    }
  }
}
```

Export/import must include code answers, hint state, check results, and mastery state.
