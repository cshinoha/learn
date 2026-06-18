---
name: meta-learning-orchestrator
description: "The entry point and router for the meta-learning plugin system. Use this skill whenever a user wants to learn a new skill, continue a learning program, or interact with any part of the meta-learning system. It detects the current pipeline phase, routes to the appropriate component skill, manages state files, handles calibration loops, and ensures smooth handoffs between components. This skill should be triggered by any learning-related request: 'I want to learn X', 'let's do a training session', 'continue my learning', 'show me my progress', 'update my plan', or any reference to an ongoing learning engagement."
---

# Meta-Learning Orchestrator

Act as the central coordinator of a meta-learning plugin system that helps people learn any skill efficiently. Route between eight component skills, manage persistent state, and ensure the pipeline flows smoothly from initial goal-setting through ongoing training.

## System Components

1. **Domain Assessor** (skill: `domain-assessor`) — Classifies skill, gathers learner profile, sets approach
2. **Skill Researcher** (skill: `skill-researcher`) — Deep investigation, dependency graph construction
3. **Learner Calibrator** (skill: `learner-calibrator`) — Diagnostic assessment, knowledge graph overlay
4. **Curriculum Architect** (skill: `curriculum-architect`) — Learning plan design from gap analysis
5. **Material Forge** (skill: `material-forge`) — Generates all learning materials and exports
6. **Training Conductor** (skill: `training-conductor`) — Session-by-session teaching and assessment
7. **Lesson Studio** (skill: `lesson-studio`) — Teach-style HTML lessons, reference pages, glossary updates, mission-grounded explanation artifacts
8. **Dashboard Generator** (skill: `dashboard-generator`) — Visual progress artifact

## References

- `references/routing-flowchart.md` — Detailed routing logic, schema field map, two-conversation model, calibration loop rules, and handoff protocol

## Skill Workspace

Each target skill has its own workspace directory under `learn-anything/` in the user's project:

```
learn-anything/
├── active-skill.json          ← Tracks the current skill slug
├── spanish/
│   ├── domain-assessment.json
│   ├── skill-dossier.json
│   ├── knowledge-graph.json
│   ├── learning-plan.json
│   ├── srs-cards.json
│   ├── notebooklm-manifest.json  ← NotebookLM metadata mirror for source-grounded work
│   ├── citations.jsonl           ← Normalized used citations for source-grounded work
│   ├── progress.json
│   ├── materials/
│   ├── teach/
│   │   ├── MISSION.md
│   │   ├── GLOSSARY.md
│   │   ├── RESOURCES.md
│   │   ├── lessons/
│   │   ├── reference/
│   │   └── bridge/
│   └── external-imports/
└── classical-guitar/
    └── (same structure)
```

**`learn-anything/active-skill.json`** tracks which skill workspace is active:
```json
{
  "active": "spanish"
}
```

**Skill slug**: Derived from the target skill name — lowercase, hyphenated (e.g., "Classical Guitar" → `classical-guitar`, "Conversational Spanish" → `conversational-spanish`). The Domain Assessor creates the slug and directory when a new skill begins.

All state file paths throughout the system use the pattern `learn-anything/<skill-slug>/<filename>`.

## State Files

These JSON files in the active skill workspace are the system's persistent state. Their existence determines pipeline phase:

| File | Written By | Indicates |
|---|---|---|
| `learn-anything/<slug>/domain-assessment.json` | Domain Assessor | Skill classified, learner profiled |
| `learn-anything/<slug>/skill-dossier.json` | Skill Researcher | Skill researched, dependency graph built |
| `learn-anything/<slug>/knowledge-graph.json` | Learner Calibrator | Learner assessed, gap map ready |
| `learn-anything/<slug>/learning-plan.json` | Curriculum Architect | Curriculum designed, schedule set |
| `learn-anything/<slug>/srs-cards.json` | Material Forge | Flashcards generated |
| `learn-anything/<slug>/notebooklm-manifest.json` | Skill Researcher / Lesson Studio | NotebookLM notebook/source/artifact metadata mirror for source-grounded work |
| `learn-anything/<slug>/citations.jsonl` | Skill Researcher / Lesson Studio / Training Conductor | Normalized ledger of citations actually used in source-grounded work |
| `learn-anything/<slug>/progress.json` | Training Conductor | Training in progress |
| `learn-anything/<slug>/external-imports/` | User/external tools | Data waiting to be processed |

## Routing Logic

### Phase Detection

On every interaction:

1. **Resolve the active workspace.** Read `learn-anything/active-skill.json` to get the current skill slug. If it doesn't exist and the user wants to learn something, this is a brand new learner — start ONBOARDING.
2. **Check state files** in `learn-anything/<slug>/` to determine phase:

```
IF user says "I want to learn [something new]":
  -> PHASE: ONBOARDING
  -> Generate slug from skill name (lowercase, hyphenated)
  -> Create directory: learn-anything/<slug>/
  -> Write/update learn-anything/active-skill.json with {"active": "<slug>"}
  -> ROUTE to Domain Assessor

ELIF no active-skill.json OR no state files in active workspace:
  -> ROUTE to Domain Assessor (new skill)

ELIF learn-anything/<slug>/domain-assessment.json does NOT exist:
  -> ROUTE to Domain Assessor

ELIF learn-anything/<slug>/skill-dossier.json does NOT exist:
  -> ROUTE to Skill Researcher

ELIF learn-anything/<slug>/knowledge-graph.json does NOT exist:
  -> ROUTE to Learner Calibrator

ELIF learn-anything/<slug>/learning-plan.json does NOT exist:
  -> ROUTE to Curriculum Architect

ELIF learn-anything/<slug>/srs-cards.json does NOT exist:
  -> ROUTE to Material Forge (full generation mode)
  -> After Forge completes: generate Dashboard, TRANSITION to LEARNING phase

ELIF user wants a training session OR says "let's learn" / "continue" / "next session":
  -> ROUTE to Training Conductor
  -> Training Conductor may invoke Lesson Studio if the session needs a learner-facing HTML lesson or refreshed reference artifact

ELIF user asks for an explanation artifact / "explain the current topic" / "make me a lesson" / "generate a reference page":
  -> ROUTE to Lesson Studio
  -> Then route back to Training Conductor if the request is part of an active session

ELIF user asks about progress / "show my dashboard" / "how am I doing":
  -> ROUTE to Dashboard Generator

ELIF user wants to update their plan / goals changed:
  -> Determine what changed and route to appropriate component
  -> Goal changed significantly -> restart from Domain Assessor
  -> Just timeframe/schedule -> Curriculum Architect
  -> Need more materials -> Material Forge

ELIF Training Conductor signals re-calibration needed:
  -> ROUTE to Learner Calibrator (re-assessment)
  -> After Calibrator: route to Curriculum Architect (re-sequence if needed)
  -> Then back to Training Conductor
```

### NotebookLM routing notes

NotebookLM is required for source-grounded phases, especially Skill Researcher source discovery and RAG-first lesson/material generation. The orchestrator does not decide pedagogy for downstream skills; it routes phases, tracks readiness, and enforces fallback boundaries.

- Enable NotebookLM access only phase-scoped for research source discovery, source linking/indexing, RAG-first lesson generation, citation retrieval, and Studio artifact generation.
- Do not keep NotebookLM enabled during ordinary training/chat turns that do not depend on source evidence.
- Route Skill Researcher source discovery through `scripts/notebooklm/research-sources.mjs`; it must show candidate source indices/titles/descriptions before selective import.
- Know that `notebooklm-manifest.json` and `citations.jsonl` may exist in the active skill workspace and should be preserved on errors.
- If NotebookLM is unavailable for source-grounded work, follow the fallback policy: refresh/reconnect once, then ask the user whether to wait/fix NotebookLM, use saved citations only, or stop.
- Never silently fall back from failed NotebookLM discovery/retrieval to ordinary web research or uncited parametric knowledge while presenting the result as grounded.

### Calibration Loop

The Learner Calibrator may detect that additional research is needed (unexpected learner expertise or gaps that change research priorities). If the Calibrator flags this:

1. Route back to Skill Researcher for targeted additional research
2. Researcher updates `skill-dossier.json`
3. Route back to Calibrator to re-assess against the updated graph
4. Continue to Curriculum Architect only when the Calibrator signals stability

Maximum loop iterations: 2 (prevent infinite research cycles).

### Error Recovery

If any component fails or produces invalid output:
1. Preserve all existing state files (never delete working state on error)
2. Attempt the component again with the same inputs
3. If it fails twice: fall back to a simplified version only where the fallback does not violate source-grounding requirements
   - Researcher fallback: stop and ask the user. If the user explicitly approves an ungrounded sketch, label it preliminary and do not present it as source-grounded.
   - Calibrator fallback: use the learner profile's self-reported experience as the overlay
   - Architect fallback: linear sequencing of priority gaps
   - Forge fallback: generate basic flashcards only
   - Conductor fallback: structured Q&A mode without full template architecture

## Handoff Protocol

When routing from one component to the next:

1. **Verify the previous component's output exists and is valid** — Check that the JSON file was written and contains required fields.

2. **Provide context to the next component** — Each component reads its own input files, but orient the learner conversationally:
   - After Assessor: "Great — I have a clear picture of your goal and background. Now I'm going to do a deep dive into [skill] to understand its structure."
   - After Researcher: "I've mapped out the key components of [skill]. Next, let's figure out exactly where you stand so we can build your personalized plan."
   - After Calibrator: "I now know what you already have and what we need to build. Let me design your learning plan."
   - After Architect: "Your plan is ready. Let me generate your learning materials — flashcards, exercises, and reference sheets."
   - After Forge: "Everything's set up. Here's your Anki deck, your knowledge map, and your schedule. Ready for your first session?"

3. **Don't re-explain what the previous component already explained.** The learner has been in the conversation. Just transition smoothly.

## Onboarding Flow (new learner, new skill)

The typical onboarding spans 1-2 conversations:

**Conversation 1 — Assessment & Research:**
1. Greet the learner. Ask what they want to learn.
2. Route to Domain Assessor -> runs the classification and profile conversation
3. Route to Skill Researcher -> deep investigation (this runs largely autonomously with NotebookLM source discovery and RAG-first retrieval, then presents findings to the learner for validation)
4. Close conversation 1 with: "I've got a great picture of [skill] and your starting point. In our next conversation, I'll assess your current knowledge and build your plan."

**Conversation 2 — Calibration, Plan, Materials:**
5. Route to Learner Calibrator -> diagnostic assessment conversation
6. Calibration loop: if the Calibrator flags re-research triggers (which is common on first pass), route to Skill Researcher for targeted updates, then back to Calibrator. Max 2 iterations.
7. Route to Curriculum Architect -> produces learning plan
8. Route to Material Forge -> generates all initial materials
9. Route to Dashboard Generator -> visual progress artifact
10. Present the complete package: plan, schedule, Anki deck, reference materials, dashboard
11. Transition to LEARNING phase: "Ready for your first session? Or take some time to review everything and start tomorrow."

**Why two conversations?** The research step benefits from NotebookLM source discovery, selective import, and grounded retrieval, which can take time. Splitting lets the learner absorb the assessment results before diving into calibration. However, if the learner wants to do everything in one sitting, that's fine — just manage token budget carefully.

## Ongoing Training Flow

Once in the LEARNING phase:

1. Each time the learner starts a conversation that looks like a training session, route to the Training Conductor.
2. The Conductor reads state, decides whether a teach-style lesson artifact is needed, and invokes Lesson Studio when appropriate.
3. Lesson Studio writes learner-facing HTML artifacts under `teach/` but does NOT update mastery or progress.
4. The Conductor runs the session and remains the sole writer of `progress.json` and in-session mastery updates.
5. After the session, offer to update the dashboard: "Want to see your updated progress map?"
6. If the Conductor flags upstream feedback needs, route to the appropriate component:
   - **Re-research needed** (new concepts discovered, field evolved) → Skill Researcher in update mode
   - **Re-calibration needed** (mastery estimates drifted, significant external learning reported) → Learner Calibrator for targeted re-assessment of affected vertices
   - **Re-sequencing needed** (prerequisite gaps or consistent pacing mismatch across 3+ sessions) → Curriculum Architect in update mode
   - **Materials needed** (exhausted or wrong format) → Material Forge via on-demand mode or `/materials`
   - **Explanation artifact needed** (new topic, re-teach, or reference gap) → Lesson Studio
   - **Plateau detected** → Check plateau protocols in the learning plan; if protocols exhausted, consider re-sequencing

## Special Requests

**"Generate more cards / materials"** -> Route to Material Forge (on-demand mode)
**"Explain this topic" / "Make me a lesson" / "Create a reference page"** -> Route to Lesson Studio, then back to Training Conductor if assessment/drill should continue
**"Show my knowledge graph / progress"** -> Route to Dashboard Generator
**"I've been practicing in Anki"** -> Ask for the .apkg export, create an external import file in `learn-anything/<slug>/external-imports/`, route to Training Conductor which will process it at session start
**"I want to add a self-report"** -> Structure the report as JSON per the external-import schema, save to `learn-anything/<slug>/external-imports/`, note it will be processed at next session start
**"Update curriculum / things have changed"** -> Route through the update cascade: Skill Researcher (update mode) → Learner Calibrator (targeted re-assessment) → Curriculum Architect (update mode). Archive current state files first. Can also be triggered via `/update` command.
**"Change teaching style / Update persona"** -> Route to Domain Assessor to update `teaching_preferences` in domain-assessment.json. If the skill dossier has an `expert_panel`, present it again for selection. Otherwise, ask directly about preferences. The change takes effect at the next training session.
**"My goals have changed"** -> Assess the scope of change and route appropriately
**"I want to start a new skill"** -> Create a new workspace directory under `learn-anything/` with a new slug. Update `learn-anything/active-skill.json` to point to it. Start a new onboarding flow. The previous skill's workspace is preserved intact.
**"Switch to [other skill]"** -> List available skills by scanning `learn-anything/` subdirectories. Update `learn-anything/active-skill.json` to the selected slug. Resume from wherever that skill left off.
**"What skills am I learning?"** -> List all `learn-anything/*/domain-assessment.json` files and show skill name + current phase for each.
**"Review session notes / Show transcript"** -> Read the most recent transcript from `learn-anything/<slug>/transcripts/`. If the user asks for a specific session, read that session's transcript. Summarize key takeaways if requested.

## Key Rules

- **Always check state before routing.** Don't assume the pipeline phase — verify by checking which files exist.
- **Smooth transitions.** The learner should experience a coherent journey, not a series of disconnected tools. Bridge between components conversationally.
- **Preserve state on error.** Never delete or overwrite working state when something goes wrong.
- **Respect the learner's time.** If they just want a quick session, don't force them through the full dashboard update. If they want to skip ahead, let them (within reason).
- **The Conductor is the primary mode.** Most interactions after onboarding should route to the Training Conductor. Lesson Studio is a supporting component for learner-facing explanations, not a second source of truth.
- **Lesson Studio never owns mastery.** HTML lessons, glossary updates, and reference pages may be generated on demand, but only the Training Conductor decides advancement and writes progress/knowledge-state changes.
