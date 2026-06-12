---
name: learn-anything
description: Use this project-local learn-anything workflow to run or test the learn-anything meta-learning system in Pi, including NotebookLM-backed source-grounded research, manifest/citation state, and validation scripts.
---

# Learn Anything

Use the local plugin sources in `learn-anything-plugin/` as the source of truth.

## When to Use

Use this skill when the user wants to:

- start or test a learn-anything learning workflow in this project;
- verify NotebookLM integration behavior in real use;
- create/check `learn-anything/<skill-slug>/notebooklm-manifest.json`;
- create/check `learn-anything/<skill-slug>/citations.jsonl`;
- validate the helper scripts and schemas added for NotebookLM.

## Project Paths

- Plugin source: `learn-anything-plugin/`
- Runtime learner state: `learn-anything/`
- NotebookLM docs: `learn-anything-plugin/docs/`
- NotebookLM schemas: `learn-anything-plugin/schemas/`
- NotebookLM helper scripts: `learn-anything-plugin/scripts/notebooklm/`

## NotebookLM Contract

Follow the repository contract:

- Links in, compact grounded evidence out.
- No file upload/download pipeline except the narrow YouTube subtitle/chapter sidecar handled only by `download_yt_subs.sh` via `add-youtube-with-subs.mjs`.
- No remote/local file staging outside that YouTube subtitle/chapter sidecar exception.
- No raw NotebookLM blobs, raw answers, full MCP dumps, private source text, credentials, cookies, tokens, retrieval caches, raw subtitle text, or raw chapter text in durable files.
- Use `notebooklm-manifest.json` for metadata mirror only.
- Use `citations.jsonl` for normalized citations actually used.
- On NotebookLM failure: refresh/reconnect once, then ask the user; no silent fallback for source-grounded work.

## Setup Expectations

Remote should have:

```bash
export NOTEBOOKLM_MCP_ENDPOINT=http://127.0.0.1:18000/mcp
```

Local machine should keep running:

```bash
notebooklm-mcp --transport http --port 8000
ssh -N -R 18000:127.0.0.1:8000 <remote-host>
```

Setup scripts:

```bash
bash learn-anything-plugin/scripts/notebooklm/setup-remote.sh --remote-port 18000
```

```powershell
powershell -ExecutionPolicy Bypass -File .\learn-anything-plugin\scripts\notebooklm\setup-local-windows.ps1 -RunLogin -StartServer
```

## Notebook Creation

Use `create-notebook.mjs` to create notebooks. This is the only way — it enforces the naming convention and immediately configures NotebookLM chat settings to `custom` goal + `shorter` response length with concise source-grounded timestamp-aware instructions:

```
LA - <skill-slug> - <skill-id> - <shard>
```

Usage:

```bash
node learn-anything-plugin/scripts/notebooklm/create-notebook.mjs <skill-slug> [skill-id] [shard-index]
```

If `skill-id` is omitted, a random 6-char hex ID is auto-generated.
If `shard-index` is omitted, 001 is used.
Output: JSON with `notebook_id`, `notebook_name`, `chat_goal`, and `chat_response_length`.

## NotebookLM Source Discovery

Use `research-sources.mjs` as the entrypoint for NotebookLM's built-in source search/recommendation workflow. It shows candidate sources first and imports only explicit selections.

Preview candidates without importing:

```bash
node learn-anything-plugin/scripts/notebooklm/research-sources.mjs \
  --notebook-id <notebook-id> \
  --query "<source discovery query>" \
  --mode deep \
  --import none
```

Import selected candidates after reviewing `sources[].index`, `title`, `url`, and `description`:

```bash
node learn-anything-plugin/scripts/notebooklm/research-sources.mjs \
  --notebook-id <notebook-id> \
  --query "<same or refined query>" \
  --mode deep \
  --import 0,2,4
```

Use `--mode fast` only for smoke tests; use `--mode deep` for real research. Do not import all sources by default unless breadth is explicitly desired and recorded.

For YouTube sources, keep NotebookLM titles timestamp-ready:
- video source: `<original-title> [<video-id>]` (no `YT -` prefix)
- subtitle sidecar: `<original-title> [<video-id>].srt.txt`
- chapters sidecar: `<original-title> [<video-id>].chapters.txt`

Use `add-youtube-with-subs.mjs` to add or post-process YouTube sources. It is the only approved download/upload exception, and raw subtitles/chapters must not be stored in manifests, citations, retrieval packs, or other durable state. Timestamp lookup must use NotebookLM sources and subtitle evidence, not direct YouTube content queries.

## Repo-local Validation

Run these after changes:

```bash
node --check learn-anything-plugin/scripts/notebooklm/configure-chat.mjs
node --check learn-anything-plugin/scripts/notebooklm/create-notebook.mjs
node --check learn-anything-plugin/scripts/notebooklm/add-youtube-with-subs.mjs
node --check learn-anything-plugin/scripts/notebooklm/query-video-timestamps.mjs
node --check learn-anything-plugin/scripts/notebooklm/research-sources.mjs
node learn-anything-plugin/scripts/notebooklm/validate-smoke-docs.mjs
node learn-anything-plugin/scripts/notebooklm/validate-manifest.mjs learn-anything-plugin/scripts/notebooklm/fixtures/valid-manifest.json
node --test learn-anything-plugin/scripts/notebooklm/*.test.mjs
node --check learn-anything-plugin/scripts/notebooklm/research-sources.mjs
node -e "const fs=require('fs'); for (const f of fs.readdirSync('learn-anything-plugin/schemas')) JSON.parse(fs.readFileSync('learn-anything-plugin/schemas/'+f,'utf8')); console.log('schemas parse')"
```

Expected: smoke docs pass, manifest validation passes, all tests pass, schemas parse.

## NotebookLM Smoke Shape

For a real usage smoke test, create/use a throwaway skill slug such as `test-notebooklm-skill` and verify:

1. Create notebook via `create-notebook.mjs` with name `LA - test-notebooklm-skill - <short-id> - 001`.
2. Run `research-sources.mjs --mode fast --import none` and verify it returns compact candidate source metadata.
3. Re-run `research-sources.mjs` with an explicit selected index list such as `--import 0`.
4. Query the notebook for grounded evidence.
5. `learn-anything/test-notebooklm-skill/notebooklm-manifest.json` exists and passes `validate-manifest.mjs`.
6. `learn-anything/test-notebooklm-skill/citations.jsonl` exists with at least one normalized used citation.
7. The local MCP sidecar logs requests to `/mcp`.

## Important Files to Read First

Before modifying implementation, read:

- `learn-anything-plugin/docs/notebooklm-implementation-plan.md`
- `learn-anything-plugin/docs/notebooklm-integration-tz.md`
- relevant files under `learn-anything-plugin/schemas/`
- relevant files under `learn-anything-plugin/scripts/notebooklm/`
