# NotebookLM Next Hooks Plan

## Goal

Extend the learn-anything NotebookLM workflow so newly created notebooks and YouTube/video source workflows are consistently configured for concise, source-grounded research, timestamp lookup, and subtitle-backed evidence.

## Current Decisions

- New NotebookLM notebooks must be created only through `create-notebook.mjs`.
- Notebook names follow:
  - `LA - <skill-slug> - <skill-id> - <shard>`
- NotebookLM chat settings for new notebooks should be configured immediately:
  - response length: `shorter`
  - tone/goal: `custom`
  - custom prompt: concise, source-grounded, timestamp-aware instructions
- YouTube source names inside NotebookLM must contain the YouTube video ID.
- Do not prefix YouTube sources with `YT -`.
- YouTube video source title convention:
  - `<original-title> [<video-id>]`
- Subtitle source title convention:
  - `<original-title> [<video-id>].srt.txt`
- Chapters source title convention:
  - `<original-title> [<video-id>].chapters.txt`
- There is a narrow exception to the “no file upload/download pipeline” rule:
  - only for YouTube subtitles and chapters;
  - only through `download_yt_subs.sh`;
  - subtitle and chapters files may be uploaded to NotebookLM as separate sources;
  - raw subtitles/chapters must not be stored in manifest, citations, retrieval packs, or other durable state.

## NotebookLM Custom Chat Prompt

Default prompt to set when configuring a notebook:

```text
You are used as a concise source-grounded research assistant for a learning workflow.

Use only the provided notebook sources. Do not invent facts, citations, timestamps, or links. If the sources do not support an answer, say so explicitly.

Keep answers short and structured. Use bullet points by default. Use tables only when they clarify comparison. Return compact JSON only when explicitly requested. Keep evidence quotes brief; quote only the minimum needed to support the answer.

For YouTube video work:
- A video source title contains the video id in square brackets: <video title> [<video-id>]
- A matching subtitle transcript source contains the same [<video-id>] and may be named <video title> [<video-id>].srt.txt
- A matching chapters source contains the same [<video-id>] and may be named <video title> [<video-id>].chapters.txt
- Prefer subtitle transcript sources for precise timestamp evidence.
- Use chapters sources to understand video structure, section boundaries, and topic navigation.
- When both subtitles and chapters are available, use chapters to identify the relevant section and subtitles to find exact timestamp evidence.
- Extract the video id from square brackets.
- Extract timestamps from subtitle cues when available.
- Convert timestamps to seconds.
- Build direct links as:
  https://www.youtube.com/watch?v=<video-id>&t=<seconds>s

Rules:
- Do not invent timestamps.
- Do not return timestamp links without source evidence.
- If timestamped evidence is unavailable, say so explicitly.
- If asked for JSON, return valid JSON only, with no Markdown fences.
```

## Planned Hooks / Wrappers

### 1. `configure-chat.mjs`

Purpose: configure NotebookLM chat settings for an existing notebook.

Default behavior:

```bash
node learn-anything-plugin/scripts/notebooklm/configure-chat.mjs \
  --notebook-id <notebook-id>
```

Defaults:

```json
{
  "goal": "custom",
  "response_length": "shorter",
  "custom_prompt": "<default prompt above>"
}
```

Expected output:

```json
{
  "status": "success",
  "notebook_id": "...",
  "chat_goal": "custom",
  "chat_response_length": "shorter"
}
```

### 2. Update `create-notebook.mjs`

After creating a convention-compliant notebook, immediately configure chat settings via `configure-chat.mjs` logic.

Creation should be considered incomplete if chat configuration fails.

Output should include:

```json
{
  "notebook_id": "...",
  "notebook_name": "LA - ...",
  "chat_goal": "custom",
  "chat_response_length": "shorter"
}
```

### 3. `add-youtube-with-subs.mjs`

Purpose: add a YouTube video source, rename it with video ID, download subtitles and chapters, and add generated files as separate NotebookLM sources.

Usage:

```bash
node learn-anything-plugin/scripts/notebooklm/add-youtube-with-subs.mjs \
  --notebook-id <notebook-id> \
  --url "https://www.youtube.com/watch?v=<video-id>"
```

Workflow:

1. Extract YouTube video ID from URL.
2. Add YouTube URL to NotebookLM.
3. Determine imported source ID/title.
4. Rename source inside NotebookLM to:
   - `<original-title> [<video-id>]`
5. Run:
   - `./download_yt_subs.sh <youtube-url> quiet`
6. Find generated subtitle file:
   - `subs/*[<video-id>].srt.txt`
7. Upload subtitle file as separate NotebookLM source.
8. Rename subtitle source to:
   - `<original-title> [<video-id>].srt.txt`
9. Find generated chapters file if present:
   - `subs/*[<video-id>].chapters.txt`
10. Upload chapters file as a separate NotebookLM source when present.
11. Rename chapters source to:
   - `<original-title> [<video-id>].chapters.txt`
12. Return compact JSON with video/subtitle/chapters source IDs and titles.

Expected output:

```json
{
  "status": "success",
  "notebook_id": "...",
  "video": {
    "video_id": "...",
    "source_id": "...",
    "title": "<original-title> [<video-id>]",
    "url": "https://www.youtube.com/watch?v=<video-id>"
  },
  "subtitles": {
    "source_id": "...",
    "title": "<original-title> [<video-id>].srt.txt",
    "local_path": "subs/<original-title> [<video-id>].srt.txt"
  },
  "chapters": {
    "source_id": "...",
    "title": "<original-title> [<video-id>].chapters.txt",
    "local_path": "subs/<original-title> [<video-id>].chapters.txt"
  }
}
```

If no chapters file exists, `chapters` should be `null` and the hook should still succeed.
```

Durable state must not store subtitle text.

### 4. Research Import YouTube Post-Processing

After `research-sources.mjs` imports selected sources, detect imported YouTube URLs and apply the YouTube post-processing hook.

Safer staged approach:

1. First implement standalone `add-youtube-with-subs.mjs`.
2. Then add optional post-import behavior to `research-sources.mjs`:
   - `--youtube-subs auto|off`
   - default TBD; likely `auto` for learn-anything workflows.

### 5. `query-video-timestamps.mjs`

Purpose: ask NotebookLM where a topic is discussed in YouTube videos and return timestamp links.

Modes:

- All YouTube/subtitle sources in a notebook.
- Selected source IDs.

Usage, all videos:

```bash
node learn-anything-plugin/scripts/notebooklm/query-video-timestamps.mjs \
  --notebook-id <notebook-id> \
  --topic "<topic>"
```

Usage, selected sources:

```bash
node learn-anything-plugin/scripts/notebooklm/query-video-timestamps.mjs \
  --notebook-id <notebook-id> \
  --topic "<topic>" \
  --source-ids <source-id-1>,<source-id-2>
```

Prompt should tell NotebookLM:

- video sources are named `<title> [<video-id>]`;
- subtitle sources are named `<title> [<video-id>].srt.txt`;
- chapters sources are named `<title> [<video-id>].chapters.txt`;
- prefer subtitle sources for timestamp precision;
- use chapters sources for video structure and section boundaries;
- build links as:
  - `https://www.youtube.com/watch?v=<video-id>&t=<seconds>s`;
- do not invent timestamps;
- return valid JSON only when JSON is requested.

Expected output:

```json
{
  "topic": "...",
  "scope": "all_youtube" | "selected_sources",
  "source_ids": ["..."],
  "matches": [
    {
      "video_title": "...",
      "video_id": "...",
      "timestamp": "00:12:34",
      "seconds": 754,
      "youtube_url": "https://www.youtube.com/watch?v=<video-id>&t=754s",
      "source_title": "...",
      "evidence": "...",
      "relevance": "..."
    }
  ],
  "limitations": []
}
```

## Manifest Strategy

Prefer no schema change initially.

Use existing fields:

- video source:
  - `resource_id`: `yt:<video-id>`
  - `source_type`: `youtube`
  - `title`: `<original-title> [<video-id>]`
- subtitle source:
  - `resource_id`: `yt-sub:<video-id>`
  - `source_type`: `doc` or `other_link` depending on how NotebookLM reports uploaded subtitle text/file
  - `title`: `<original-title> [<video-id>].srt.txt`
- chapters source:
  - `resource_id`: `yt-chapters:<video-id>`
  - `source_type`: `doc` or `other_link` depending on how NotebookLM reports uploaded chapters text/file
  - `title`: `<original-title> [<video-id>].chapters.txt`

If this becomes too limiting, later add explicit source metadata to schema.

## Documentation / Skill Updates

Update:

- `.pi/skills/learn-anything/SKILL.md`
- `learn-anything-plugin/skills/skill-researcher/SKILL.md`
- `learn-anything-plugin/skills/lesson-studio/SKILL.md`
- `learn-anything-plugin/skills/training-conductor/SKILL.md`

Rules to document:

- New notebooks are chat-configured to custom + shorter.
- YouTube video source title must contain `[video-id]` inside NotebookLM.
- Subtitle source title must contain the same `[video-id]` and end with `.srt.txt`.
- Chapters source title must contain the same `[video-id]` and end with `.chapters.txt`.
- YouTube subtitles/chapters sidecar is the only allowed file download/upload exception.
- Timestamp lookup uses NotebookLM sources and subtitle evidence only.
- Do not query YouTube directly for content except through the subtitle sidecar.

## Validation Commands

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

## Live Smoke Test Plan

After implementation and with MCP tunnel active:

1. Create a throwaway notebook via `create-notebook.mjs`.
2. Verify chat config is custom + shorter.
3. Add a YouTube URL via `add-youtube-with-subs.mjs`.
4. Verify video source title inside NotebookLM contains `[video-id]`.
5. Verify subtitle source exists and title is `<title> [<video-id>].srt.txt`.
6. If chapters exist, verify chapters source exists and title is `<title> [<video-id>].chapters.txt`.
7. Run `query-video-timestamps.mjs` for a topic present in the video.
8. Verify returned links are valid YouTube timestamp links.
