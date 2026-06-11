# План реализации: NotebookLM integration для learn-anything

Дата: 2026-06-10  
Основано на: `docs/notebooklm-integration-tz.md`  
Статус: план реализации, не выполненная реализация

## 0. Принципы реализации

1. **Не делать file pipeline.** Только links/URLs в NotebookLM, без передачи файлов между remote/local и без скачивания артефактов.
2. **Не раздувать контекст.** NotebookLM ищет полноценно, но `learn-anything` получает compact retrieval pack.
3. **Не держать MCP всегда включённым.** Использовать phase-scoped enablement.
4. **Не делать silent fallback.** При сбое: `refresh_auth` один раз, затем спросить пользователя.
5. **Не начинать кодовые изменения до smoke test.** Сначала проверить реальные capabilities `jacob-bd/notebooklm-mcp-cli`.
6. **Секреты не писать в state.** Endpoint/token/auth только в env/MCP config. State files содержат IDs, links, citations, metadata.

## 1. Целевой результат v1

После реализации `learn-anything` должен уметь:

1. Работать с локальным `notebooklm-mcp-cli` через SSH reverse HTTP endpoint.
2. Привязывать один skill к массиву NotebookLM notebook'ов.
3. Хранить mirror состояния в `learn-anything/<skill-slug>/notebooklm-manifest.json`.
4. Выполнять RAG-first retrieval через `cross_notebook_query`.
5. Возвращать в LLM только compact retrieval pack.
6. Хранить normalized citations в `learn-anything/<skill-slug>/citations.jsonl`.
7. Легко расширить `research_sources` metadata/pointers без хранения больших snippets.
8. Автоматически создавать 1–2 NotebookLM Studio artifacts для крупных уроков по роли, сохраняя только metadata/links.
9. Поддерживать fallback: `refresh once -> ask user`.

## 2. Фаза 1 — Critical smoke test repo

Цель: проверить, что выбранный repo реально закрывает обязательный путь.

### 2.1. Установка локально

На локальной машине пользователя:

```bash
uv tool install notebooklm-mcp-cli
# или
pipx install notebooklm-mcp-cli
```

Проверка:

```bash
which nlm
which notebooklm-mcp
nlm --help
notebooklm-mcp --help
```

### 2.2. Auth

```bash
nlm login
```

Проверить:

```bash
nlm login --check
```

Если используется profile:

```bash
nlm login --profile learn-anything
nlm login switch learn-anything
```

### 2.3. HTTP transport

Локально:

```bash
notebooklm-mcp --transport http --port 8000
```

Если HTTP transport нестабилен, проверить SSE:

```bash
notebooklm-mcp --transport sse --port 8000
```

### 2.4. SSH reverse tunnel

Пример:

```bash
ssh -N -R 18000:127.0.0.1:8000 <remote-host>
```

Ожидаемый результат:

```text
remote localhost:18000 -> local 127.0.0.1:8000 -> notebooklm-mcp
```

Remote config example:

```bash
export NOTEBOOKLM_MCP_ENDPOINT=http://127.0.0.1:18000
```

Точный способ подключения MCP client к HTTP endpoint зафиксировать после проверки среды.

### 2.5. Tool smoke

Проверить через MCP client / endpoint:

1. `server_info`
2. `notebook_list`
3. `notebook_create`
4. `source_add` только link-based:
   - обычный URL;
   - YouTube URL;
   - Drive/doc link, если доступно.
5. `notebook_query`
6. `cross_notebook_query` по двум notebook'ам
7. `studio_create` для lightweight artifact metadata:
   - `quiz` или `study guide`;
   - optionally `infographic`.
8. `refresh_auth`

### 2.6. Что не тестировать как обязательный путь

Не включать в mandatory smoke:

- file upload;
- file download;
- artifact download;
- передачу PDF/book файлов;
- local/remote staging.

### 2.7. Smoke report

Создать после проверки:

```text
docs/notebooklm-smoke-report.md
```

Минимальный формат:

```markdown
# NotebookLM MCP smoke report

- Date:
- Local OS:
- Remote host:
- notebooklm-mcp-cli version:
- Auth mode/profile:
- Transport tested: http/sse
- SSH reverse command shape:

## Results

| Capability | Result | Notes |
|---|---|---|
| server_info | pass/fail | |
| notebook_list | pass/fail | |
| notebook_create | pass/fail | |
| source_add URL | pass/fail | |
| source_add YouTube | pass/fail | |
| source_add Drive/doc link | pass/fail | |
| notebook_query | pass/fail | |
| cross_notebook_query | pass/fail | |
| studio_create metadata | pass/fail | |
| refresh_auth | pass/fail | |

## Blocking issues

## Adjustments required before implementation
```

## 3. Фаза 2 — Data model и schemas

Цель: зафиксировать state formats до изменения skill prompts.

### 3.1. Добавить schemas

Новые файлы:

```text
schemas/notebooklm-manifest.schema.json
schemas/citation.schema.json
schemas/retrieval-pack.schema.json
```

### 3.2. `notebooklm-manifest.schema.json`

Назначение: mirror технического состояния NotebookLM notebooks array.

Рекомендуемые top-level fields:

```json
{
  "version": "1.0",
  "skill_slug": "...",
  "skill_id": "short-id",
  "created_at": "...",
  "updated_at": "...",
  "naming_convention": "LA - <skill-slug> - <short-id> - <shard>",
  "binding_strategy": "names_plus_mirror",
  "transport": {
    "type": "http_via_ssh_reverse",
    "endpoint_env": "NOTEBOOKLM_MCP_ENDPOINT"
  },
  "notebooks": [],
  "sources": [],
  "artifacts": [],
  "sync": {}
}
```

`notebooks[]`:

```json
{
  "shard_index": 1,
  "notebook_id": "...",
  "notebook_name": "LA - python - a1b2c3 - 001",
  "status": "active|full|stale|missing|error",
  "created_at": "...",
  "last_seen_at": "...",
  "last_query_at": "...",
  "last_error": null
}
```

`sources[]`:

```json
{
  "resource_id": "...",
  "source_id": "...",
  "notebook_id": "...",
  "shard_index": 1,
  "title": "...",
  "url": "...",
  "source_type": "url|youtube|drive|doc|other_link",
  "curation_status": "candidate|curated|linked|indexed|failed|stale",
  "learning_role": "explanation|visualization|demonstration|practice|reference|motivation|source_evidence|assessment|other",
  "linked_at": "...",
  "last_verified_at": "...",
  "last_error": null
}
```

`artifacts[]`:

```json
{
  "artifact_id": "...",
  "notebook_id": "...",
  "artifact_type": "audio|video|report|quiz|flashcards|mind_map|slide_deck|infographic|data_table|other",
  "title": "...",
  "url": "...",
  "metadata": {},
  "created_for": "lesson:<id>|material:<id>|source:<id>",
  "created_at": "...",
  "status": "created|linked|failed|stale",
  "last_error": null
}
```

`sync`:

```json
{
  "mode": "write_through_remote_writes_mirror",
  "last_sync_at": "...",
  "last_sidecar_seen_at": "...",
  "last_error": null
}
```

Не хранить секреты:

- no Google cookies;
- no auth tokens;
- no tunnel tokens;
- no raw credentials.

### 3.3. `citation.schema.json`

Одна citation соответствует одной строке в `citations.jsonl`.

Рекомендуемые поля:

```json
{
  "citation_id": "...",
  "created_at": "...",
  "skill_slug": "...",
  "query_id": "...",
  "used_for": "lesson:<id>|question:<id>|material:<id>|research:<id>",
  "notebook_id": "...",
  "source_id": "...",
  "source_title": "...",
  "source_url": "...",
  "location_type": "timestamp|page|section|slide|paragraph|quote|url|other",
  "location": "...",
  "timestamp_seconds": 123.0,
  "page": "...",
  "section_title": "...",
  "snippet": "...",
  "deep_link": "...",
  "confidence": "high|medium|low"
}
```

Rules:

- normalized only;
- no raw NotebookLM blob;
- snippets must be short;
- citations are appended only when actually used.

### 3.4. `retrieval-pack.schema.json`

Transient object passed from NotebookLM retrieval to the LLM context.

Рекомендуемые поля:

```json
{
  "pack_id": "...",
  "created_at": "...",
  "skill_slug": "...",
  "query": "...",
  "retrieval_mode": "cross_notebook_query",
  "notebook_ids": [],
  "answer_summary": "...",
  "citations": [],
  "followup_queries": [],
  "confidence": "high|medium|low",
  "limitations": []
}
```

Rules:

- compact;
- no cache by default;
- can be written temporarily during generation but should not become a long-term cache.

### 3.5. Расширить `skill-dossier.schema.json`

Только lightweight metadata + pointers в `research_sources`.

Добавить optional fields:

```json
{
  "format": "article|book|paper|course|docs|video|slides|diagram|infographic|interactive|audio|community|tool|other",
  "learning_role": "explanation|visualization|demonstration|practice|reference|motivation|source_evidence|assessment|community|other",
  "audience_level": "beginner|intermediate|advanced|mixed|unknown",
  "annotation": "1-2 строки зачем источник нужен",
  "curation_status": "candidate|curated|linked|indexed|rejected|stale",
  "resource_id": "...",
  "notebook_id": "...",
  "source_id": "...",
  "citation_refs": []
}
```

Не добавлять большие snippets в `research_sources`.

## 4. Фаза 3 — Helper scripts: minimal toolkit

Цель: поддержать схемы без полноценного adapter/service layer.

Рекомендуемая директория:

```text
scripts/notebooklm/
```

### 4.1. `validate_manifest.py`

Функции:

- validate manifest по schema;
- проверить уникальность `shard_index`;
- проверить naming convention;
- проверить уникальность `notebook_id`;
- проверить, что `sources[].notebook_id` существует в `notebooks[]`;
- проверить, что secrets не попали в manifest.

CLI sketch:

```bash
python scripts/notebooklm/validate_manifest.py learn-anything/<skill-slug>/notebooklm-manifest.json
```

### 4.2. `append_citation.py`

Функции:

- validate citation object;
- append в `citations.jsonl`;
- dedupe по stable key:
  ```text
  skill_slug + source_id + location_type + location + snippet hash
  ```
- optionally print citation_id.

CLI sketch:

```bash
python scripts/notebooklm/append_citation.py \
  --ledger learn-anything/<skill-slug>/citations.jsonl \
  --citation /tmp/citation.json
```

### 4.3. `build_retrieval_pack.py`

Функции:

- принять raw/normalized NotebookLM result от агента;
- нормализовать compact pack;
- ограничить вывод до compact answer + selected citations;
- validate по `retrieval-pack.schema.json`;
- optionally emit citations для ledger.

CLI sketch:

```bash
python scripts/notebooklm/build_retrieval_pack.py \
  --input /tmp/notebooklm-result.json \
  --manifest learn-anything/<skill-slug>/notebooklm-manifest.json \
  --output /tmp/retrieval-pack.json
```

Не делать в v1:

- scripts that call MCP directly;
- service daemon;
- file transfer;
- artifact download automation.

## 5. Фаза 4 — Skill prompt updates

Цель: научить pipeline использовать NotebookLM без переписывания всей архитектуры.

### 5.1. `skills/skill-researcher/SKILL.md`

Добавить секцию `NotebookLM RAG / indexed resources`.

Изменения:

1. Перед deep research проверять, доступен ли NotebookLM phase-scoped MCP.
2. Если доступен:
   - использовать hybrid discovery;
   - при source-grounded вопросах использовать RAG-first;
   - использовать `cross_notebook_query` по notebook array skill'а;
   - сохранять только compact retrieval pack в контекст;
   - curated source metadata писать в `research_sources`;
   - detailed citations писать в `citations.jsonl`;
   - manifest обновлять write-through после NotebookLM операций.
3. Source model: link-only.
4. Не упоминать file upload/download как default workflow.
5. При сбое: `refresh_auth` once, затем спросить пользователя.

### 5.2. `skills/lesson-studio/SKILL.md`

Добавить правила:

1. Для source triggers урока использовать RAG-first.
2. Запрашивать NotebookLM перед написанием фактических/источниковых объяснений.
3. Использовать compact retrieval pack, не полный длинный ответ NotebookLM.
4. В HTML урок вставлять citations/timestamps/deep links.
5. Обновлять `teach/RESOURCES.md` короткими аннотациями.
6. Для крупных уроков автоматически создавать 1–2 NotebookLM artifacts по роли.
7. Хранить только artifact metadata/links.

### 5.3. `skills/material-forge/SKILL.md`

Добавить правила:

1. Resource lists использовать `research_sources` + manifest/citation pointers.
2. NotebookLM artifacts могут быть источником учебных материалов, но files не скачивать по default.
3. External resource list должен показывать короткие аннотации: зачем открыть, уровень, роль.
4. Для визуальных тем предпочитать infographic/mind_map artifacts, если NotebookLM их создал.

### 5.4. `skills/training-conductor/SKILL.md`

Добавить source triggers:

RAG-first обязателен для:

- factual explanation;
- source question;
- citation/timestamp request;
- book/doc/video reference;
- disputed claim;
- lesson-like explanation.

RAG-first не обязателен для:

- coaching;
- motivation;
- session flow;
- meta-learning discussion.

Fallback:

- при NotebookLM ошибке: refresh once;
- если не помогло: спросить пользователя;
- не делать silent fallback.

### 5.5. `skills/orchestrator/SKILL.md`

Добавить routing notes:

1. NotebookLM MCP включать phase-scoped.
2. State files:
   - `notebooklm-manifest.json`;
   - `citations.jsonl`.
3. Orchestrator не решает pedagogy вместо downstream skills, только знает readiness/fallback.
4. If NotebookLM unavailable and source-grounded task requested: ask user according to fallback policy.

## 6. Фаза 5 — README / docs updates

Обновить `README.md`:

1. В state files добавить:
   ```text
   notebooklm-manifest.json
   citations.jsonl
   ```
2. Добавить короткий раздел `NotebookLM integration`:
   - optional but preferred for indexed source-grounded learning;
   - local sidecar;
   - SSH reverse HTTP;
   - link-only;
   - compact retrieval pack;
   - no files in/out.
3. Добавить setup overview без секретов:
   ```bash
   nlm login
   notebooklm-mcp --transport http --port 8000
   ssh -N -R 18000:127.0.0.1:8000 <remote-host>
   export NOTEBOOKLM_MCP_ENDPOINT=http://127.0.0.1:18000
   ```
4. Добавить warning:
   - NotebookLM uses internal APIs;
   - auth may expire;
   - fallback asks user.

## 7. Фаза 6 — E2E validation в learn-anything

После schema/scripts/skill docs обновлений проверить один полный сценарий.

### 7.1. Setup

Создать тестовый skill workspace:

```text
learn-anything/test-notebooklm-skill/
```

Подготовить:

- `active-skill.json`;
- минимальный `domain-assessment.json`;
- minimal `skill-dossier.json`.

### 7.2. Notebook binding

Проверить:

1. Создание/нахождение notebook shards по имени.
2. Запись `notebooklm-manifest.json`.
3. Link-only source add для URL/YouTube.
4. Failure-only rollover вручную смоделировать, если нельзя достичь лимита.

### 7.3. RAG query

Проверить:

1. `cross_notebook_query` по notebook array.
2. Compact retrieval pack.
3. Запись used citations в `citations.jsonl`.
4. `research_sources` содержит metadata+pointers, без больших snippets.

### 7.4. Lesson Studio

Проверить:

1. Урок использует RAG-first при source trigger.
2. HTML содержит citations/timestamps/deep links.
3. `teach/RESOURCES.md` содержит short annotations.
4. Для крупного урока создан 1–2 artifacts.
5. Artifact сохранён как metadata/link only.

### 7.5. Failure behavior

Проверить:

1. Остановить tunnel или испортить endpoint.
2. Убедиться: первая ошибка вызывает refresh/reconnect once.
3. Если не помогло — система спрашивает пользователя.
4. Silent fallback отсутствует.

## 8. Acceptance criteria

v1 считается готовым, если:

1. Smoke test repo пройден или ограничения явно зафиксированы.
2. `notebooklm-manifest.json` валидируется schema/helper script.
3. `citations.jsonl` валидируется и dedupe работает.
4. `retrieval-pack` компактен и валидируется.
5. `skill-dossier.research_sources` хранит metadata+pointers, без больших snippets.
6. `skill-researcher`, `lesson-studio`, `material-forge`, `training-conductor`, `orchestrator` обновлены согласно scope.
7. RAG-first работает по source triggers.
8. `cross_notebook_query` используется для массива notebook'ов.
9. Artifacts создаются auto-for-lessons role-based 1–2 и сохраняются metadata-only.
10. No-cache policy соблюдается.
11. No file transfer policy соблюдается.
12. Fallback policy соблюдается: refresh once, then ask.
13. README описывает setup и ограничения.

## 9. Rollback plan

Если интеграция ломает pipeline:

1. Отключить phase-scoped NotebookLM usage в orchestrator/skills.
2. Оставить state files нетронутыми:
   - `notebooklm-manifest.json`;
   - `citations.jsonl`.
3. Вернуть behavior к обычному web-search/LLM research.
4. Не удалять citations и manifest: они могут быть полезны после фикса.

Если schema extension ломает старые dossiers:

1. Все новые поля должны быть optional.
2. Старые `skill-dossier.json` должны оставаться валидными.
3. Migration не обязательна для старых skills до первого NotebookLM usage.

## 10. Риски

| Риск | Митигировать |
|---|---|
| NotebookLM internal APIs изменятся | Smoke test, fallback ask user, phase-scoped usage |
| HTTP transport нестабилен | SSE fallback после проверки |
| `cross_notebook_query` не даёт нужные citations | Перейти на manual fan-out как v1.1 fallback |
| NotebookLM не возвращает deep links/timestamps стабильно | Citation confidence + explicit limitations |
| Manifest drift | write-through updates + validate_manifest |
| Context bloat от MCP tools | phase-scoped enablement |
| Context bloat от retrieval | compact pack |
| Случайный file workflow | explicit non-goal: link-only, no files |
| Auth протухает | lazy refresh once, then ask |

## 11. Порядок выполнения задач

1. Пройти critical smoke test.
2. Зафиксировать smoke report.
3. Добавить schemas.
4. Добавить helper scripts minimal toolkit.
5. Обновить `skill-dossier.schema.json` optional metadata+pointers.
6. Обновить `skill-researcher`.
7. Обновить `lesson-studio`.
8. Обновить `material-forge`.
9. Обновить `training-conductor`.
10. Обновить `orchestrator` routing notes.
11. Обновить README.
12. Пройти E2E validation.
13. Зафиксировать known limitations.

## 12. Что не делать без отдельного решения

1. Не строить полноценный NotebookLM adapter service.
2. Не добавлять file upload/download.
3. Не делать remote/local file staging.
4. Не скачивать NotebookLM artifacts по умолчанию.
5. Не включать MCP always-on.
6. Не хранить raw NotebookLM blobs.
7. Не делать retrieval cache.
8. Не вводить custom MCP policy layer.
9. Не делать semantic sharding вместо auto-by-size.
10. Не заменять `research_sources` отдельным heavy resource catalog.
