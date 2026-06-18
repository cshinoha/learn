# NotebookLM scripts smoke test

## Environment

```bash
export NOTEBOOKLM_MCP_ENDPOINT=http://localhost:18000/mcp
```

## Create notebook

```bash
node learn-anything-plugin/scripts/notebooklm/create-notebook.mjs python-basics
```

Expected:
- JSON with `notebook_id`
- notebook name follows `LA - <skill-slug> - <skill-id> - <shard>`

## Discover sources

```bash
node learn-anything-plugin/scripts/notebooklm/research-sources.mjs \
  --notebook-id <notebook_id> \
  --query "expert curriculum for learning Python basics" \
  --mode deep \
  --import none
```

Expected:
- JSON with `sources[]`
- each source has `index`, `title`, `url`, `description`

## Import selected sources

```bash
node learn-anything-plugin/scripts/notebooklm/research-sources.mjs \
  --notebook-id <notebook_id> \
  --query "expert curriculum for learning Python basics" \
  --mode deep \
  --import 0,2,4
```

Expected:
- JSON with `imported`
- no raw source text printed

## Query video timestamps

```bash
node learn-anything-plugin/scripts/notebooklm/query-video-timestamps.mjs \
  --notebook-id <notebook_id> \
  --topic "list comprehension"
```

Expected:
- JSON only
- no invented timestamps
- empty `matches` plus limitations if evidence is unavailable
