# NotebookLM MCP smoke workflow

Status: prepared only. This workflow is a reproducible manual checklist for a future human or agent with real NotebookLM MCP access. It does not claim live NotebookLM execution. The repository environment has **not** run live NotebookLM, NotebookLM MCP, HTTP transport, SSH tunneling, or end-to-end validation.

## Reader and outcome

Reader: a future validator who can access the approved NotebookLM MCP environment.

After reading this workflow, the validator can run a tiny, safe smoke test and fill the smoke report without needing the planning context that produced this document.

## 1. Scope and safety contract

- Prepared-only status: this document defines the smoke test but does not claim live NotebookLM execution.
- Use link-only sources. Add source URLs or approved provider links to NotebookLM; do not upload, download, or copy private source text through this repository.
- No local retrieval cache. NotebookLM stores and indexes linked sources; learn-anything keeps only compact metadata, status rows, limitations, and citations that are safe to retain.
- Metadata-only artifacts. Persist notebook IDs, source IDs, safe labels, timestamps, compact status rows, and redacted error summaries only.
- Redaction and no secrets are mandatory. Never write cookies, bearer headers, API keys, OAuth tokens, session files, SSH private material, raw NotebookLM blobs, raw NotebookLM answers, or full MCP request/response dumps.
- Phase-scoped enablement: start NotebookLM MCP only for this smoke phase and stop it during cleanup.
- No silent fallback: if NotebookLM or MCP fails, record the failure and stop or ask for human input. Do not silently continue as ordinary web research.
- Auth refresh once: on auth/session failure, make one auth refresh attempt through `refresh_auth` if the MCP server exposes it, then record `blocked` if it still fails.

## 2. Setup inventory

Before any NotebookLM mutation, record safe inventory in the report:

| Item | What to record | What not to record |
|---|---|---|
| Validation account | Safe account label, not an email if private | Cookies, OAuth files, session paths |
| MCP server | Server name/version if discoverable | Full config dump or headers |
| Transport | Safe endpoint label such as `localhost MCP` | Bearer headers, tunnel credentials |
| CLI/runtime | Tool name and version string | Shell history, environment dumps |
| Source set | Public URL labels and source kinds | Downloaded copies or private text |

If a required CLI or MCP tool is absent, stop before NotebookLM mutation and record `blocked` with a redacted failure summary.

## 3. Auth and session handling

1. Confirm the validator is using an approved NotebookLM validation account.
2. Confirm credentials live outside this repository and are not copied into the report.
3. Start with existing approved session state when available.
4. If the first authenticated MCP call fails, run the documented `refresh_auth` path once.
5. If refresh fails or is unavailable, record `blocked`. Do not retry indefinitely, paste cookies, or switch to ordinary browsing as fallback.

Safe evidence: `auth ok`, `refresh_auth attempted once`, or a redacted reason such as `session expired after refresh`.

## 4. Start MCP transport and optional SSH tunnel

Start the NotebookLM HTTP MCP server only for this smoke phase. Record a sanitized endpoint label such as `localhost MCP`, not tokens, headers, process environment, or full server config.

Use SSH tunneling only when the approved MCP setup requires it.

- Record only a safe tunnel label such as `local tunnel active`.
- Do not record SSH usernames, hostnames if sensitive, private key paths, identity files, forwarded auth headers, or connection strings.
- If the tunnel drops before or during a NotebookLM call, record `blocked` or `partial` depending on whether any prior capability was proven.
- Close the tunnel during cleanup.

If transport or tunnel setup fails, record a `blocked` verdict with a redacted error summary and stop. Do not silently continue as ordinary web research.

## 5. Tool inventory

Record the observed MCP tool inventory before mutation:

| Tool | Expected purpose | Observed status | Notes |
|---|---|---|---|
| server_info | identify server and version | `not run` / `pass` / `partial` / `blocked` / `unknown` | |
| notebook_list | list notebooks | `not run` / `pass` / `partial` / `blocked` / `unknown` | |
| notebook_create | create validation notebook | `not run` / `pass` / `partial` / `blocked` / `unknown` | |
| source_add | add link-only sources | `not run` / `pass` / `partial` / `blocked` / `unknown` | |
| notebook_query | query a notebook | `not run` / `pass` / `partial` / `blocked` / `unknown` | |
| refresh_auth | refresh auth once | `not run` / `pass` / `partial` / `blocked` / `unknown` | |

`unknown` means the validator could not determine support without unsafe dumping or unsupported introspection.

## 6. Server info and notebook creation

Call the server info or equivalent discovery tool. Record:

- timestamp
- server name/version when safe
- supported tools by name only
- redacted failure summary if unavailable

Do not retain raw MCP discovery payloads.

Create or select a temporary smoke notebook with a safe label, for example `learn-anything smoke YYYY-MM-DD`.

Persist only safe metadata:

- notebook ID
- notebook label
- timestamp
- status

Do not persist full NotebookLM notebook blobs or source text.

## 7. Link-only source binding checks

Use one to three public, non-sensitive links. Add only link-only sources. Do not upload files, downloaded content, private notes, or local source files.

Required source rows:

| Source kind | Input policy | Status | Safe evidence |
|---|---|---|---|
| URL article | public non-sensitive URL | `not run` / `pass` / `partial` / `blocked` / `unknown` | source ID, safe title, timestamp |
| YouTube/video | public non-sensitive video link | `not run` / `pass` / `partial` / `blocked` / `unknown` | source ID, safe title, timestamp support |
| Drive/doc link | approved link only | `not run` / `pass` / `partial` / `blocked` / `unknown` | source ID or redacted block reason |

If a source is rejected or stale, record the source kind, safe label, and redacted provider reason. Do not replace it silently with a different retrieval path.

## 8. Grounded query and citation check

Run a grounded notebook query that asks for a compact synthesis with citations.

Record only compact observations:

- short grounded answer summary written by the validator, not the raw answer blob
- selected citation IDs or safe citation links
- timestamps when available
- notebook ID and source IDs
- citation support limitations

If the answer is missing citations, mark the query result `partial` or `blocked`; do not fabricate citations and do not treat uncited web research as NotebookLM success.

## 9. NotebookLM/MCP capability recording and requirement impact

Record NotebookLM/MCP capability results in a compact table:

| Capability | Verdict | Evidence | Limitation or failure mode |
|---|---|---|---|
| server_info | `not run` / `pass` / `partial` / `blocked` / `unknown` | metadata only | |
| notebook_list | `not run` / `pass` / `partial` / `blocked` / `unknown` | metadata only | |
| notebook_create | `not run` / `pass` / `partial` / `blocked` / `unknown` | notebook ID only | |
| source_add URL | `not run` / `pass` / `partial` / `blocked` / `unknown` | source ID only | |
| source_add YouTube | `not run` / `pass` / `partial` / `blocked` / `unknown` | source ID, timestamp support | |
| source_add Drive/doc link | `not run` / `pass` / `partial` / `blocked` / `unknown` | source ID or redacted block | |
| notebook_query | `not run` / `pass` / `partial` / `blocked` / `unknown` | compact synthesis and citations | |
| refresh_auth | `not run` / `pass` / `partial` / `blocked` / `unknown` | refresh attempted once on auth failure | |

This workflow owns the S01 smoke contract. It supports downstream manifest, citation, prompt, and routing slices by defining what evidence and limitations can be safely recorded before those slices depend on NotebookLM assumptions.

Downstream consumers may rely on safe capability verdicts, link-only source binding evidence, citation support observations, redacted limitation rows, and explicit no-silent-fallback outcomes. Downstream consumers must not rely on private source text, raw NotebookLM blobs, full MCP dumps, local retrieval caches, downloaded source files, credentials, cookies, tokens, or SSH secrets.

## 10. Failure modes

Every failure mode must be visible and named:

| Failure mode | Expected behavior | Safe evidence |
|---|---|---|
| Transport unavailable | Stop and record `blocked`; no ordinary web fallback | Redacted connection summary |
| Auth/session failure | Attempt `refresh_auth` once; if still failing, record `blocked` | Redacted auth summary |
| CLI absence/version mismatch | Stop before mutation and record `blocked` | CLI name/version or absence |
| HTTP transport failure | Stop and record `blocked`; no ordinary web fallback | Redacted connection summary |
| SSH tunnel failure | Close tunnel if open; record `blocked` or `partial` | Safe tunnel label only |
| Rejected/stale source | Record source kind and limitation; do not replace silently | Safe source label and redacted reason |
| Grounded-query timeout | Record timeout and whether retry is allowed by operator | Compact timeout row |
| Missing citations | Mark query `partial` or `blocked`; do not fabricate citations | Citation absence note |
| Malformed return shape | Record malformed response summary without raw payload | Shape summary only |
| Unexpected MCP response | Record response-shape problem without raw dump | Redacted shape summary |
| NotebookLM unavailable | Stop and record `blocked`; ask for human input outside repo if needed | Availability summary |
| No-silent-fallback behavior | Any failed NotebookLM path remains failed until explicitly resolved | Failure row proving no fallback |

External dependencies are NotebookLM service availability, Google account/session state, MCP CLI/server, HTTP transport, optional SSH tunnel, public source URLs, filesystem access for these docs, and the Node validator. The smoke contract intentionally bubbles failures into report rows instead of hiding them.

## 11. Load profile and negative tests

Expected load is a tiny manual smoke run:

- one validation operator
- one temporary notebook
- one to three public non-sensitive URLs
- one compact grounded query
- compact status rows only
- no bulk ingestion, crawling, batching, or parallel load

At 10x expected load, the first saturation risk is NotebookLM/MCP/provider rate limits and source-ingestion latency, not local disk. Protection is policy-based: do not run bulk ingestion from this workflow, keep source count bounded, keep answers compact, and record `blocked` or `partial` if manual smoke limits are exceeded.

The future smoke run must explicitly record negative outcomes rather than treating them as success:

| Negative scenario | Required observation |
|---|---|
| Invalid or expired auth | `refresh_auth` attempted once, then `blocked` if unresolved |
| Rejected link | Source row records rejected/stale source and redacted reason |
| Dropped tunnel or HTTP transport | Transport/tunnel failure row recorded; no fallback to web research |
| Missing citations | Query row marked `partial` or `blocked`; citations not fabricated |
| Failed NotebookLM path | Final verdict reflects failure; downstream slices see limitation |
| Malformed MCP return shape | Shape issue summarized without raw dump |
| Unsafe evidence encountered | Evidence is redacted or discarded before durable storage |

These are prose negative tests for a manual workflow. The deterministic validator checks that the policy sections exist; live negative behavior must be proven during the actual smoke run.

## 12. Cleanup

After the smoke test:

- Stop the HTTP MCP server.
- Close SSH tunnels if used.
- Remove temporary notebooks/sources if the validation account requires cleanup.
- Revoke or refresh test credentials if the CLI documentation recommends it.
- Delete local scratch logs that contain secrets or private source text.
- Keep only the sanitized smoke report and any safe metadata required for follow-up work.
- Confirm no local retrieval cache, downloaded source files, full MCP dumps, raw NotebookLM blobs, credentials, cookies, tokens, or SSH private data remain in durable artifacts.

## 13. Final verdict

The validator should choose one report verdict:

- `pass`: core NotebookLM MCP path works for link binding, grounded query, citation observation, and safe metadata capture.
- `partial`: some core capability works, but limitations require downstream adaptation.
- `blocked`: auth, transport, tool availability, source policy, or NotebookLM availability prevents meaningful validation.
- `not run`: environment was not available; workflow remains prepared only.
- `unknown`: a specific capability could not be safely determined; explain why and choose an overall verdict that does not overstate success.

A `pass` or `partial` verdict still must preserve the no-cache, link-only, metadata-only, phase-scoped, refresh-once, no-silent-fallback contract.
