# learn-anything

A Claude Code plugin that helps people learn any skill efficiently. It synthesizes Tim Ferriss' DiSSS/CaFE meta-learning frameworks with evidence-based enhancements from cognitive psychology, instructional design, and motivation science.

The system is domain-agnostic: Spanish, guitar, negotiation, programming, pharmacology, cooking, chess — any skill.

## Commands

| Command | Purpose |
|---|---|
| `/learn [topic or context]` | Primary interface — start, resume, or manage any skill |
| `/train [context or --mode mentor]` | Jump straight into a training session |
| `/materials [type] [task-class]` | Generate or regenerate learning materials *(v2.0)* |
| `/update [what changed]` | Update curriculum for evolving fields *(v2.0)* |

`/learn` delegates to the orchestrator, which handles everything: new skills, resuming, switching, progress checks, material generation, imports, and plan updates. Just describe what you want naturally — `/learn Spanish`, `/learn progress`, `/learn I'm stuck on chord transitions`.

`/train` is a shortcut that skips directly to the Training Conductor for your active skill.

The orchestrator also activates automatically for natural-language requests like "I want to learn Spanish" or "teach me guitar".

## Pipeline

Nine skills form a coordinated pipeline, managed by the orchestrator:

```
Onboarding (1-2 conversations):

  Domain Assessor ──> Skill Researcher ──> Learner Calibrator
  (classify skill,     (decompose skill,    (diagnostic assessment,
   learner profile)     dependency graph)     knowledge overlay)

                           ↓ calibration loop (max 2x)

  Curriculum Architect ──> Material Forge ──> Dashboard Generator
  (4C/ID sequencing,       (Anki decks,       (React artifact,
   dual timeline)           exercises)          knowledge map)

Learning (ongoing, session-by-session):

  Training Conductor ──> Lesson Studio
  (Socratic teaching,     (teach-style HTML lessons,
   adaptive difficulty,    references, glossary,
   mastery gates,          mission-grounded explanations)
   progress tracking)
```

## What's New in v2.0

- **Conversational epitome refinement** — The Curriculum Architect pauses to discuss the first lesson before building the full plan
- **Instructor personas** — Choose a teaching style inspired by masters of the field (e.g., Feynman for physics)
- **Mentor conversation mode** — Relaxed, exploratory discussions via `/train --mode mentor`
- **Session transcripts** — Full session logs saved to `transcripts/` for review
- **Curriculum updates** — `/update` command for evolving fields
- **Material generation** — `/materials` command for on-demand content with dedicated subagents
- **Teach-style lesson artifacts** — Lesson Studio creates beautiful self-contained HTML lessons, reference pages, and glossary-driven explanations inside the active skill workspace
- **Improved research** — Ferriss interview protocol now mandatory, freshness detection for cutting-edge fields
- **Better visuals** — WCAG-compliant color contrast, inline SVG over Mermaid for learning materials
- **Expert panel** — Skill Researcher identifies masters of the field for persona selection

## Skills

| Skill | Purpose |
|---|---|
| `meta-learning-orchestrator` | Central router — detects pipeline phase, manages state, handles handoffs |
| `domain-assessor` | Classifies skill type/environment, gathers learner profile, sets approach strategy |
| `skill-researcher` | Web-search-grounded decomposition, dependency graph, frequency/impact analysis |
| `learner-calibrator` | Adaptive diagnostic using Knowledge Space Theory, graph propagation, transfer probes |
| `curriculum-architect` | 4C/ID whole-task sequencing, Elaboration Theory epitome, productive failure placement |
| `material-forge` | Anki flashcards, worked examples, practice sets, assessments, visualizations, and lesson-generation orchestration |
| `training-conductor` | Interactive sessions using 5 templates (A-E), escalation ladder, real-time calibration |
| `lesson-studio` | Teach-style HTML lessons, quick-reference pages, glossary updates, and mission-grounded explanation artifacts |
| `dashboard-generator` | React artifact with knowledge graph, curriculum roadmap, retention metrics |

## State Files

Each skill gets its own workspace under `learn-anything/<skill-slug>/` in the user's project. The active skill is tracked in `learn-anything/active-skill.json`. This supports learning multiple skills simultaneously without file collisions.

```
<user-project>/
└── learn-anything/
    ├── active-skill.json
    ├── spanish/
    │   ├── domain-assessment.json
    │   ├── skill-dossier.json
    │   ├── knowledge-graph.json
    │   ├── learning-plan.json
    │   ├── srs-cards.json
    │   ├── notebooklm-manifest.json  # optional NotebookLM metadata mirror
    │   ├── citations.jsonl           # optional normalized used citations
    │   ├── progress.json
    │   ├── materials/
    │   ├── teach/
    │   │   ├── MISSION.md
    │   │   ├── GLOSSARY.md
    │   │   ├── RESOURCES.md
    │   │   ├── lessons/
    │   │   └── reference/
    │   └── external-imports/
    └── classical-guitar/
        └── (same structure)
```

| File | Producer | Schema |
|---|---|---|
| `domain-assessment.json` | Domain Assessor | `schemas/domain-assessment.schema.json` |
| `skill-dossier.json` | Skill Researcher | `schemas/skill-dossier.schema.json` |
| `knowledge-graph.json` | Learner Calibrator + Training Conductor | `schemas/knowledge-graph.schema.json` |
| `learning-plan.json` | Curriculum Architect | `schemas/learning-plan.schema.json` |
| `srs-cards.json` | Material Forge | `schemas/srs-cards.schema.json` |
| `notebooklm-manifest.json` | Skill Researcher / Lesson Studio | `schemas/notebooklm-manifest.schema.json` |
| `citations.jsonl` | Skill Researcher / Lesson Studio / Training Conductor | `schemas/citation.schema.json` (one JSON object per line) |
| `progress.json` | Training Conductor | `schemas/progress.schema.json` |
| `external-imports/` | User/external tools | `schemas/external-import.schema.json` |

## NotebookLM Integration

NotebookLM support is optional but preferred for indexed, source-grounded learning. The integration is designed around this contract:

```text
Links in, compact grounded evidence out. No files in/out.
```

Architecture overview:

```text
remote learn-anything
  -> SSH reverse HTTP endpoint
  -> local notebooklm-mcp-cli sidecar
  -> NotebookLM notebooks
```

The default workflow is link-only. The plugin links curated URLs, YouTube URLs, Drive/doc links, or other approved provider links into NotebookLM; it does not upload/download source files, stage local files, download NotebookLM artifacts, store raw NotebookLM blobs, or cache retrieval results. NotebookLM can produce a compact retrieval pack for the main LLM context: short synthesis, selected citations, timestamps/deep links, source IDs, notebook IDs, confidence, and limitations.

Setup overview (keep secrets outside repo/state files):

```bash
nlm login
notebooklm-mcp --transport http --port 8000
ssh -N -R 18000:127.0.0.1:8000 <remote-host>
export NOTEBOOKLM_MCP_ENDPOINT=http://127.0.0.1:18000
```

Helper scripts:

```powershell
# Local Windows machine: installs uv/notebooklm-mcp-cli, verifies nlm/notebooklm-mcp,
# optionally runs login and starts the HTTP sidecar.
powershell -ExecutionPolicy Bypass -File .\learn-anything-plugin\scripts\notebooklm\setup-local-windows.ps1 -RunLogin -StartServer
```

```bash
# Remote machine where learn-anything skills run: installs/verifies Node.js,
# persists NOTEBOOKLM_MCP_ENDPOINT, and runs repo-local validators.
bash learn-anything-plugin/scripts/notebooklm/setup-remote.sh --remote-port 18000
```

Runtime state:

- `learn-anything/<skill-slug>/notebooklm-manifest.json` mirrors NotebookLM notebook shards, linked sources, artifact metadata, sync status, and redacted errors.
- `learn-anything/<skill-slug>/citations.jsonl` stores normalized citations actually used by lessons/research/training.
- `skill-dossier.research_sources` stays lightweight: title/link, format, role, level, annotation, curation status, and pointers.

Limitations: NotebookLM MCP currently relies on internal/unsupported NotebookLM APIs via `notebooklm-mcp-cli`; auth can expire and transports can fail. On NotebookLM failure the system should refresh/reconnect once, then ask the user how to proceed. Silent fallback is forbidden for source-grounded work.

## Prerequisites

Python 3 with the `genanki` package (required for Anki deck export by the Material Forge skill):

```bash
# Using uv (recommended)
uv pip install -r requirements.txt

# Or using pip
pip install -r requirements.txt
```

## Installation

### From a local path (for development or testing)

```bash
# from command line run
claude plugin marketplace add /path/to/learn-anything
```

```bash
# Not validated
# In Claude Code, run:
/plugin marketplace add /path/to/learn-anything
```

### From the marketplace

If this plugin is published to a GitHub-based marketplace:

```bash
# Not validated
# In Claude Code, run:
/plugin marketplace add NetRxn/learn-anything
```

Then enable the plugin when prompted. All 9 skills are auto-discovered from the `skills/` directory.


### Verify installation

Once installed, the `meta-learning-orchestrator` skill activates automatically when you say things like "I want to learn Spanish" or "teach me guitar". You can also check `/plugin` to confirm the plugin is enabled.

### Add to your project's .gitignore

The plugin writes learner state to a `learn-anything/` directory in your project. Add this to your project's `.gitignore`:

```
learn-anything/
```

## Key Frameworks

- **DiSSS**: Deconstruction, Selection, Sequencing, Stakes
- **CaFE**: Compression, Frequency, Encoding
- **4C/ID**: Whole-task instruction with sawtooth scaffolding (van Merrienboer)
- **Elaboration Theory**: Epitome-first design (Reigeluth)
- **Productive Failure**: Struggle-before-instruction for conceptual learning (Kapur)
- **FSRS**: Machine-learned spaced repetition scheduling
- **Knowledge Space Theory**: Efficient diagnostic assessment (Doignon & Falmagne)
- **Seven-Layer Motivation Architecture**: Identity, process goals, competence feedback, flow/deliberate practice, relatedness, plateau protocols, strategic stakes

## Anki Round-Trip

The plugin supports bidirectional data flow with Anki:

1. Material Forge generates `.apkg` with deterministic GUIDs and hidden `KnowledgeNodeID` fields
2. User reviews cards in Anki (using FSRS scheduler)
3. User exports review history back to the plugin
4. Training Conductor processes reviews, updates knowledge graph mastery estimates
5. Updated graph informs next session's content and difficulty
