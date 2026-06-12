# NotebookLM Next Hooks Live Smoke Report

Date: 2026-06-12

## Environment

- MCP endpoint used by scripts: default `http://localhost:18000/mcp` (`NOTEBOOKLM_MCP_ENDPOINT` was not set in the shell, but the reverse tunnel/default endpoint was reachable).
- NotebookLM MCP version: `0.7.2`
- Auth status: `configured`
- Smoke notebook: `LA - test-notebooklm-hooks - smoke2 - 001`
- Smoke notebook ID: `1f6f67ba-39ff-42f6-9c56-4e55095cc094`
- YouTube smoke URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`

## Results

| Capability | Result | Evidence / Notes |
|---|---:|---|
| `server_info` | pass | Returned version `0.7.2`, auth `configured`. |
| `notebook_list` | pass | Returned existing notebooks. |
| `create-notebook.mjs` | pass | Created `1f6f67ba-39ff-42f6-9c56-4e55095cc094` and returned `chat_goal: custom`, `chat_response_length: shorter`. |
| `configure-chat.mjs` | pass | `chat_configure` is the correct MCP tool for this installed version. |
| YouTube URL add | pass | Added/used source `6129e119-7685-49e3-a17e-b3e425f2011d`. |
| YouTube source rename | pass | Source title became `Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster) [dQw4w9WgXcQ]`. |
| Subtitle sidecar generation | pass | `download_yt_subs.sh` generated a `.srt.txt` sidecar under `subs/`. Raw subtitle text was not copied into this report or durable state. |
| Subtitle source add | pass with fallback | Direct MCP `source_type=file` could not read the remote path through the reverse-tunnel setup, so `add-youtube-with-subs.mjs` fell back to streaming the sidecar as a NotebookLM text source without storing raw text in durable state. Source ID: `118158f3-d58c-4091-b37f-6e5f6980b0b6`. |
| Subtitle source rename | pass | Source title became `Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster) [dQw4w9WgXcQ].srt.txt`. |
| Chapters sidecar | n/a | No chapters file existed for this video; hook returned `chapters: null` and succeeded. |
| `query-video-timestamps.mjs` | pass | Returned valid JSON with subtitle-backed timestamps and YouTube links, e.g. `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43s`. |
| `research-sources.mjs --import none` | pass | Fast research completed with `sources_found: 10`, `youtube_subs: auto`, `youtube_postprocess: []`. |
| Static validation/tests | pass | All `node --check`, smoke doc validation, manifest validation, and `14/14` Node tests passed. |

## Issues Found and Fixed During Smoke

1. MCP chat configuration tool name for `notebooklm-mcp-cli 0.7.2` is `chat_configure`, not the initial guessed names.
   - Fixed `configure-chat.mjs` to call `chat_configure` with exact schema args.

2. MCP tools reject unexpected args because schemas use `additionalProperties: false`.
   - Fixed `source_add`, `source_rename`, and `chat_configure` calls to use exact argument names (`source_type`, `new_title`, etc.).

3. Direct local-file upload failed in the SSH reverse-tunnel shape because the MCP sidecar could not access the remote file path.
   - Added a controlled fallback in `add-youtube-with-subs.mjs`: read the approved YouTube sidecar transiently and add it as a NotebookLM `text` source with the expected title.
   - Raw subtitle/chapter text is not written to manifests, citations, retrieval packs, or this report.

## Commands Run

```bash
node learn-anything-plugin/scripts/notebooklm/create-notebook.mjs test-notebooklm-hooks smoke2 001

node learn-anything-plugin/scripts/notebooklm/add-youtube-with-subs.mjs \
  --notebook-id 1f6f67ba-39ff-42f6-9c56-4e55095cc094 \
  --url 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

node learn-anything-plugin/scripts/notebooklm/query-video-timestamps.mjs \
  --notebook-id 1f6f67ba-39ff-42f6-9c56-4e55095cc094 \
  --topic 'the line never gonna give you up'

node learn-anything-plugin/scripts/notebooklm/research-sources.mjs \
  --notebook-id 1f6f67ba-39ff-42f6-9c56-4e55095cc094 \
  --query 'Rick Astley Never Gonna Give You Up official video' \
  --mode fast \
  --import none \
  --max-wait 120
```

Validation:

```bash
node --check learn-anything-plugin/scripts/notebooklm/configure-chat.mjs
node --check learn-anything-plugin/scripts/notebooklm/create-notebook.mjs
node --check learn-anything-plugin/scripts/notebooklm/add-youtube-with-subs.mjs
node --check learn-anything-plugin/scripts/notebooklm/query-video-timestamps.mjs
node --check learn-anything-plugin/scripts/notebooklm/research-sources.mjs
node learn-anything-plugin/scripts/notebooklm/validate-smoke-docs.mjs
node learn-anything-plugin/scripts/notebooklm/validate-manifest.mjs learn-anything-plugin/scripts/notebooklm/fixtures/valid-manifest.json
node --test learn-anything-plugin/scripts/notebooklm/*.test.mjs
```

## Final Verdict

The next-hooks workflow is live-smoke usable with the current tunnel:

- notebook creation + immediate chat configuration works;
- YouTube source naming works;
- subtitle sidecar ingestion works through the controlled text-source fallback;
- timestamp lookup returns valid JSON with evidence-backed YouTube timestamp links;
- no raw subtitle text was stored in durable state.
