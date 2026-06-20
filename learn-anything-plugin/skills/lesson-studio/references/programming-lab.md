# Programming Lab Rendering

Use this reference only when the Lesson Studio page spec includes a `programming_lab` block.

## Renderer Boundary

This file describes how to render a provided programming lab. It does not authorize adding a lab because the topic is programming-related.

The page spec must provide the lab intent, language, editable code, checks, hints, and any filename needed for local verification.

## Editable Code Rule

When the lab asks the learner to fix, complete, refactor, or inspect code, the relevant code must be editable directly in the HTML lesson.

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

## Hints

Use only hints provided by the page spec. If hint levels are provided, render them as closed reveal blocks. Do not invent extra hint levels.

## Verification

Render verification commands, expected output, or browser checks only when provided by the page spec. Browser-side heuristic checks are allowed only if explicitly requested.

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
