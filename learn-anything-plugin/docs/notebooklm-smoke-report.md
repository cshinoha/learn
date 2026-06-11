# NotebookLM MCP smoke report

Status: prepared only. Fill this report only with real observations from a live NotebookLM MCP smoke run. Until then, every row remains `not run`. The repository environment has **not** run live NotebookLM, NotebookLM MCP, HTTP transport, SSH tunneling, or end-to-end validation.

Allowed verdicts: `not run`, `pass`, `partial`, `blocked`, `unknown`.

## 1. Run metadata

| Field | Value |
|---|---|
| Smoke run timestamp | `not run` |
| Operator | `not run` |
| Environment label | `not run` |
| NotebookLM MCP server | `not run` |
| HTTP transport label | `not run` |
| SSH tunnel label, if used | `not run` |
| Validation account label | `not run` |
| Source set label | `not run` |
| Final human verdict | `not run` |

Verdict: `not run` / `pass` / `partial` / `blocked` / `unknown`

## 2. Safety checklist

| Contract | Status | Evidence |
|---|---|---|
| Prepared-only status preserved until live run | `not run` | |
| Link-only sources used | `not run` | |
| No local retrieval cache created | `not run` | |
| Metadata-only artifacts retained | `not run` | |
| No private source text retained | `not run` | |
| No raw NotebookLM answer blobs retained | `not run` | |
| No raw NotebookLM blobs retained | `not run` | |
| No full MCP request/response dumps retained | `not run` | |
| No downloaded source files retained | `not run` | |
| Redaction completed | `not run` | |
| No tokens, cookies, bearer headers, API keys, SSH private data, or session files recorded | `not run` | |
| No silent fallback to ordinary web research | `not run` | |
| Refresh-auth attempted once on auth failure | `not run` | |
| Phase-scoped MCP cleanup completed | `not run` | |

## 3. Tool inventory

| Tool | Observed | Version or notes | Failure summary |
|---|---|---|---|
| server_info | `not run` | | |
| notebook_list | `not run` | | |
| notebook_create | `not run` | | |
| source_add URL | `not run` | | |
| source_add YouTube | `not run` | | |
| source_add Drive/doc link | `not run` | | |
| notebook_query | `not run` | | |
| refresh_auth | `not run` | | |

Use only safe tool names and version strings. Do not paste full MCP dumps, headers, session files, or raw response payloads.

## 4. Notebook metadata

| Field | Safe value |
|---|---|
| Notebook ID | `not run` |
| Notebook label | `not run` |
| Created or reused | `not run` |
| Created timestamp | `not run` |
| Cleanup action | `not run` |

Notebook metadata must stay compact. Do not include private notebook content or full NotebookLM notebook blobs.

## 5. Source metadata

| Source kind | Source ID | Safe title or label | Status | Notes |
|---|---|---|---|---|
| URL article | `not run` | `not run` | `not run` | |
| YouTube/video | `not run` | `not run` | `not run` | |
| Drive/doc link | `not run` | `not run` | `not run` | |

Statuses may be `not run`, `pass`, `partial`, `blocked`, or `unknown`. Source rows must contain only link-only source metadata. Do not store downloaded source files, copied source text, local retrieval cache entries, or raw provider responses.

## 6. Query and citation result

| Check | Status | Compact evidence |
|---|---|---|
| Grounded answer returned | `not run` | |
| Selected citations returned | `not run` | |
| Timestamp/deep link support observed | `not run` | |
| Raw answer blob excluded from report | `not run` | |
| Only compact observations retained | `not run` | |
| Missing citations handled as limitation | `not run` | |

Allowed evidence: short validator-written synthesis, citation IDs or safe links, timestamp/deep-link support notes, and redacted limitation summaries. Do not paste raw NotebookLM answers.

## 7. NotebookLM/MCP capability recording

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

Use `unknown` when the validator cannot safely determine a capability without unsafe dumping, unsupported introspection, or policy-violating source access.

## 8. Failure modes and limitations

| Failure mode | Status | Redacted error summary | Follow-up |
|---|---|---|---|
| Transport unavailable | `not run` | | |
| Auth/session failure | `not run` | | |
| CLI absence/version mismatch | `not run` | | |
| HTTP transport failure | `not run` | | |
| SSH tunnel failure | `not run` | | |
| Source rejected | `not run` | | |
| Rejected/stale source | `not run` | | |
| Grounded-query timeout | `not run` | | |
| Query unsupported | `not run` | | |
| Citation missing | `not run` | | |
| Missing citations | `not run` | | |
| Malformed return shape | `not run` | | |
| Unexpected MCP response | `not run` | | |
| NotebookLM unavailable | `not run` | | |
| No-silent-fallback behavior | `not run` | | |

Failure behavior policy: external dependency failures must be recorded as `partial`, `blocked`, or `unknown`; they must not be hidden by ordinary web research, local retrieval cache, or invented citations.

## 9. Load profile

Expected smoke load:

| Resource | Expected load | 10x breakpoint risk | Protection |
|---|---|---|---|
| Operator activity | one manual validator | process confusion and inconsistent evidence rows | follow this scaffold row by row |
| Notebook count | one temporary notebook | NotebookLM account clutter and cleanup mistakes | reuse or delete temporary smoke notebook |
| Sources | one to three public non-sensitive URLs | provider rate limits and ingestion latency | no bulk ingestion, crawling, batching, or parallel load |
| Queries | one compact grounded query | NotebookLM/MCP timeout or quota | keep prompt compact and record timeout as limitation |
| Durable evidence | compact status rows only | accidental raw dumps or private data | metadata-only and redaction checklist |

If the run exceeds this tiny profile, mark the affected capability `partial`, `blocked`, or `unknown` and add a downstream follow-up instead of continuing as a load test.

## 10. Negative tests

Record these negative outcomes explicitly if observed during the smoke run:

| Negative scenario | Expected report result | Evidence allowed |
|---|---|---|
| Invalid or expired auth | `refresh_auth` attempted once, then `blocked` if unresolved | redacted auth summary |
| Rejected link | source row marked `blocked` or `partial` | safe source label and redacted reason |
| Dropped tunnel or HTTP transport | transport/tunnel row marked `blocked` or `partial` | safe tunnel or endpoint label |
| Missing citations | query row marked `partial` or `blocked` | citation absence note |
| Failed NotebookLM path | final verdict reflects failure | limitation row and downstream follow-up |
| Malformed MCP return shape | capability row marked `blocked` or `unknown` | response-shape summary, no raw dump |
| Unsafe evidence encountered | evidence discarded or redacted before durable storage | redaction note |

These are manual negative tests in prose. A live run should make failed paths visible and must never silently treat a failed NotebookLM path as successful retrieval.

## 11. Requirement impact

This report is the durable S01 smoke contract. It supports downstream manifest, citation, prompt, and routing slices by recording what NotebookLM/MCP evidence can be trusted and what limitations must shape later design.

Downstream slices may consume:

- verdicts: `pass`, `partial`, `blocked`, `not run`, and `unknown`
- safe notebook/source IDs and labels
- link-only source support notes
- citation support and timestamp/deep-link observations
- redacted failure summaries
- explicit no-silent-fallback limitations

Downstream slices must not consume or request durable storage of:

- secrets, cookies, tokens, bearer headers, session files, or SSH private data
- private source text
- raw NotebookLM blobs or raw answer blobs
- full MCP request/response dumps
- downloaded source files
- local retrieval cache contents

## 12. Cleanup confirmation

Before sharing or committing this report, confirm:

- Stop the HTTP MCP server.
- Close SSH tunnels if used.
- Remove temporary notebooks or sources if required by the validation account.
- Delete local scratch logs containing secrets or private source text.
- Keep only compact observations, statuses, timestamps, safe notebook/source labels, safe citation IDs, and redacted failure summaries.
- No local retrieval cache remains.
- No downloaded source files remain.
- No raw NotebookLM blobs or full MCP dumps remain.
- No credentials or private source text remain in durable artifacts.

## 13. Final human verdict

Final human verdict: `not run` / `pass` / `partial` / `blocked` / `unknown`

Rationale:

- `not run`: prepared-only scaffold exists, but no live NotebookLM MCP validation was executed.
- `pass`: core link binding, query, citation, and safe metadata capture worked.
- `partial`: some required capability worked, but limitations affect downstream design.
- `blocked`: auth, transport, tool availability, NotebookLM availability, or policy prevented meaningful validation.
- `unknown`: a specific capability could not be safely determined without unsafe evidence or unsupported introspection.

Final downstream follow-ups:

| Follow-up | Owning downstream area | Reason |
|---|---|---|
| `not run` | `not run` | `not run` |
