---
name: learn-anything
description: "Entry skill for the learn-anything meta-learning system in Pi. Use when the user invokes /learn or /train, wants to learn a new skill, continue/resume training, inspect progress, calibrate a learner, generate learning materials, or manage any learn-anything workspace. Delegates to meta-learning-orchestrator and component skills."
---

# Learn Anything for Pi

This is a Pi wrapper for the Claude Code `learn-anything` plugin installed under:

`~/.pi/agent/skills/learn-anything-plugin/`

## Use

When this skill is triggered, load and follow the orchestrator skill:

`~/.pi/agent/skills/learn-anything-plugin/skills/orchestrator/SKILL.md`

Treat natural commands as aliases:

- `/learn <topic>` or "хочу изучить X" → start/resume via orchestrator.
- `/train` or "продолжим тренировку" → route to training conductor via orchestrator.
- "объясни текущую тему" or "сделай урок по теме" → route to lesson studio via orchestrator (and back to the conductor if the session continues).
- "покажи прогресс" → route to dashboard/progress via orchestrator.
- "сгенерируй материалы" → route to material forge via orchestrator.

## Pi path note

Pi resolves skill-relative paths from the skill directory. The copied component skills include symlinks to plugin-level `schemas/` and `agents/` so references such as `schemas/progress.schema.json` work from component skill directories.

## Workspace note

The original plugin expects workspaces under `learn-anything/<skill-slug>/`. If the current project already has legacy state files at the project root or in a skill-named directory, inspect `active-skill.json` and existing folders before creating a new workspace.
