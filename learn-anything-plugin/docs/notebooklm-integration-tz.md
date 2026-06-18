# ТЗ: интеграция NotebookLM в learn-anything

Дата: 2026-06-10  
Статус: согласованный дизайн, не реализация

## 1. Цель

Добавить в `learn-anything` интеграцию с NotebookLM как с retrieval/indexing-ядром для учебных источников.

Цели:

1. Использовать индекс NotebookLM для видео, текстов, книг, презентаций, схем, инфографики, интерактивов и других полезных учебных источников.
2. Снижать расход токенов основного LLM: NotebookLM ищет внутри своих источников сам, а в контекст агента попадает только компактный grounded result.
3. Давать точные ссылки на источник:
   - timestamp в YouTube/видео;
   - deep link на источник;
   - section/page/slide/fragment в документах.
4. Интегрировать найденные источники в уроки и материалы без превращения результата в свалку ссылок.

Главная формула:

```text
Links in, compact grounded evidence out.
No files in/out.
```

## 2. Архитектура

```text
remote learn-anything
  ↓ env / MCP config
SSH reverse tunnel
  ↓
local notebooklm-mcp-cli sidecar
  ↓
NotebookLM notebooks
```

Используем конкретный репозиторий:

```text
https://github.com/jacob-bd/notebooklm-mcp-cli
```

v1 жёстко ориентирован на этот repo.

## 3. Transport

Выбрано:

```text
SSH reverse + HTTP-first
```

Локально запускается:

```bash
notebooklm-mcp --transport http --port 8000
```

Remote получает endpoint через env/MCP config, например:

```bash
NOTEBOOKLM_MCP_ENDPOINT=http://127.0.0.1:<remote-forwarded-port>
```

SSE допускается как fallback, но default — HTTP.

Repo check по документации `jacob-bd/notebooklm-mcp-cli`:

- `notebooklm-mcp` поддерживает `--transport stdio|http|sse`;
- default transport: `stdio`;
- есть `--port`, default `8000`;
- есть tools: `notebook_list`, `notebook_create`, `source_add`, `notebook_query`, `cross_notebook_query`, `studio_create`, `download_artifact`, `research_start`, `research_import`, `batch`, `tag`, `refresh_auth`, `server_info`.

## 4. Auth model

Авторизация живёт на стороне локального sidecar.

- `nlm login` выполняется локально.
- Cookies/profile остаются локально.
- Remote `learn-anything` не хранит Google cookies.
- Preflight auth check не обязателен.

Выбрано:

```text
Lazy refresh
```

При первой auth/tunnel ошибке:

1. один раз пробуем `refresh_auth` / reconnect;
2. если не помогло — спрашиваем пользователя.

## 5. Sources model

Критически важно:

```text
link-only, no file transfer
```

Нельзя проектировать это как загрузку локальных файлов.

`learn-anything` / MCP отправляет в NotebookLM ссылки:

- YouTube URL;
- web URL;
- Drive/doc links;
- source links.

Не надо:

- гонять файлы между remote и local;
- скачивать источники;
- загружать PDF/book files через remote;
- делать local file staging;
- формулировать базовый workflow как file upload.

NotebookLM сам индексирует источники по ссылкам.

## 6. Skill → notebooks model

Из-за лимитов NotebookLM:

```text
1 skill -> массив notebook'ов
```

Не один notebook на skill.

Шардинг:

```text
auto by size
```

Rollover:

```text
failure only
```

Текущий notebook используется, пока NotebookLM не откажется добавлять новый source/link. После отказа создаётся следующий shard.

Naming convention:

```text
LA - <skill-slug> - <short-id> - 001
LA - <skill-slug> - <short-id> - 002
...
```

Binding:

```text
Names + mirror
```

Notebook'и находятся по naming convention, а mirror хранит точные IDs/status/source mapping.

## 7. Manifest mirror

Файл:

```text
learn-anything/<skill-slug>/notebooklm-manifest.json
```

Назначение:

- список notebook shards;
- notebook IDs;
- notebook names;
- shard order;
- source mapping;
- source IDs;
- artifact metadata/links;
- sync status;
- last errors.

Source of truth:

```text
sidecar owns real NotebookLM state
remote learn-anything writes mirror
```

Sidecar выполняет NotebookLM операции, remote получает результат и write-through обновляет manifest.

## 8. Search / RAG

Выбрано:

```text
RAG-first
```

Для source-grounded задач `learn-anything` сначала спрашивает NotebookLM, потом формирует ответ/урок.

Поиск по массиву notebook'ов:

```text
Built-in cross_notebook_query
```

Использовать tool repo:

```text
cross_notebook_query
```

Не делать ручной fan-out в v1, если `cross_notebook_query` работает.

## 9. Compact retrieval pack

NotebookLM может искать сколько угодно внутри себя — это не расходует токены основного LLM.

Но в контекст агента возвращается:

```text
compact pack
```

Содержимое:

- короткий grounded answer / synthesis;
- selected citations;
- timestamps;
- deep links;
- source IDs;
- notebook IDs.

Не возвращать полный длинный ответ NotebookLM, если это не нужно.

## 10. Citations

Выбрано:

```text
Normalized only
```

Без raw blob.

Citation object должен поддерживать:

- `citation_id`;
- `notebook_id`;
- `source_id`;
- `source_url`;
- `source_title`;
- `location_type`:
  - `timestamp`;
  - `page`;
  - `section`;
  - `slide`;
  - `paragraph`;
  - `quote`;
  - `url`;
- `location`;
- `timestamp_seconds`;
- `page`;
- `section_title`;
- `snippet`;
- `deep_link`;
- `confidence`;
- `used_for`.

Детальные citations не хранить внутри `skill-dossier.json`, чтобы не раздувать контекст.

Формат хранения:

```text
learn-anything/<skill-slug>/citations.jsonl
```

Одна citation на строку.

## 11. `research_sources`

`skill-dossier.research_sources` должен быть лёгким.

Хранить там:

- source title;
- URL/link;
- format;
- learning_role;
- audience_level;
- short annotation;
- curation_status;
- pointers на manifest/source IDs;
- pointers на citation ledger.

Не хранить там большие snippets.

## 12. Resource curation

Использование новых форматов:

```text
Куратор + уроки
```

Форматы:

- YouTube/video;
- presentations/slides;
- diagrams;
- infographics;
- interactive demos/playgrounds;
- docs;
- articles;
- books;
- courses;
- other useful formats.

Отбор:

```text
по учебной роли
```

Роли:

- explanation;
- visualization;
- demonstration;
- practice;
- reference;
- motivation;
- source_evidence;
- assessment.

Показ пользователю:

```text
короткие аннотации
```

## 13. Discovery

Выбрано:

```text
Hybrid discovery
```

Использовать:

1. текущий web-search процесс `skill-researcher`;
2. NotebookLM research tools, если полезно;
3. curated-only source linking.

Важно: импорт/linking в NotebookLM только для curated sources, не raw pool.

## 14. Artifacts

NotebookLM Studio artifacts использовать автоматически для крупных уроков.

Выбрано:

```text
Auto for lessons
Role-based 1-2 artifacts
Metadata only
```

На крупный урок выбирать 1–2 artifact по учебной роли.

Примеры:

| Ситуация | Artifact |
|---|---|
| визуальная тема | infographic / mind_map |
| проверка понимания | quiz |
| повторение | study guide / flashcards |
| длинная тема | audio/video overview |
| презентационный материал | slide deck |

Хранение:

```text
metadata/links only
```

Не скачивать artifacts локально по умолчанию.

## 15. Cache

Выбрано:

```text
No cache
```

Каждый RAG-first запрос заново идёт в NotebookLM.

Сохраняются только реально использованные citations в `citations.jsonl`.

## 16. MCP tool loading

Repo даёт много tools, это само по себе раздувает context.

Выбрано:

```text
Phase-scoped enablement
```

NotebookLM MCP активировать только для фаз:

- research;
- RAG-first lesson generation;
- source linking/indexing;
- artifact generation;
- citation retrieval.

Не держать MCP постоянно включённым во всех training/chat turn'ах.

## 17. Fallback behavior

Если NotebookLM недоступен:

1. lazy refresh once;
2. если не помогло — спросить пользователя.

Пользователь выбирает:

- ждать / чинить NotebookLM;
- продолжить без NotebookLM;
- использовать уже сохранённые citations;
- остановить source-grounded работу.

Silent fallback запрещён.

## 18. Skills to update

Scope v1:

```text
Core four + orchestrator notes
```

Обновить:

1. `skill-researcher`;
2. `lesson-studio`;
3. `material-forge`;
4. `training-conductor`;
5. краткие routing notes в `orchestrator`.

### `skill-researcher`

Обязанности:

- hybrid discovery;
- curated source selection;
- link-only NotebookLM source adding;
- update `research_sources`;
- maintain manifest mirror;
- use NotebookLM for source-grounded deconstruction when relevant.

### `lesson-studio`

Обязанности:

- RAG-first for source-grounded lessons;
- compact retrieval pack;
- citations/timestamps/deep links in lessons;
- auto NotebookLM artifacts for крупные уроки;
- update `teach/RESOURCES.md` with short annotations.

### `material-forge`

Обязанности:

- use curated resources;
- generate external resource lists;
- reference NotebookLM artifacts by metadata/link;
- avoid downloading artifacts by default.

### `training-conductor`

RAG-first только по source triggers:

- factual explanation;
- source question;
- citation/timestamp request;
- book/doc/video reference;
- disputed claim;
- lesson-like explanation.

Не обязательно использовать NotebookLM для:

- coaching;
- motivation;
- session flow;
- meta-learning discussion.

### `orchestrator`

Обязанности:

- route phases where NotebookLM should be enabled;
- know fallback behavior;
- know manifest/citation files exist;
- avoid keeping NotebookLM MCP always active.

## 19. Schemas

Выбрано:

```text
Separate schemas
```

Добавить/описать:

1. `notebooklm-manifest.schema.json`;
2. `citation.schema.json`;
3. `retrieval-pack.schema.json`.

Также лёгкое расширение:

```text
skill-dossier.schema.json -> research_sources metadata + pointers
```

## 20. Helper scripts

Scope v1:

```text
Minimal toolkit
```

Нужны helper scripts для:

1. manifest validation/sync;
2. citation JSONL validation/dedupe;
3. compact retrieval-pack building.

Не делать пока полноценный adapter/service layer.

## 21. Critical smoke test

Перед реализацией пройти smoke test repo.

Обязательные проверки:

1. `notebooklm-mcp-cli` установлен.
2. `nlm login` работает.
3. HTTP transport работает:
   ```bash
   notebooklm-mcp --transport http --port 8000
   ```
4. SSH reverse tunnel работает.
5. Remote видит endpoint.
6. `notebook_list` работает.
7. `notebook_create` работает.
8. link source add работает:
   - URL;
   - YouTube URL;
   - Drive/doc link, если поддерживается.
9. `notebook_query` работает.
10. `cross_notebook_query` работает по нескольким notebook'ам.
11. `studio_create` возвращает artifact metadata/link.
12. `refresh_auth` работает или корректно падает.
13. manifest mirror можно write-through обновить.
14. citation JSONL можно append/validate/dedupe.

Не входит в обязательный smoke:

- file upload;
- file download;
- artifact download;
- remote/local file transfer.

## 22. Non-goals v1

Не делать в v1:

- file upload/download pipeline;
- передачу файлов между remote и local;
- custom security policy внутри MCP;
- full custom NotebookLM adapter service;
- semantic notebook sharding;
- always-on MCP;
- raw citation blob storage;
- caching retrieval results;
- отдельный heavy resource catalog вместо `research_sources`.

## 23. Открытые вопросы перед реализацией

Нужно ещё уточнить/проверить:

1. точные env variable names для endpoint/config;
2. точный формат `notebooklm-manifest.json`;
3. точный формат `citations.jsonl`;
4. точный формат `retrieval-pack`;
5. насколько `cross_notebook_query` реально возвращает timestamps/deep links;
6. где именно хранить artifact metadata:
   - manifest;
   - отдельный `artifacts.jsonl`;
   - lesson metadata;
7. как naming convention восстанавливает state при потерянном manifest;
8. как отличать curated source от candidate source;
9. какие source links считать допустимыми для NotebookLM;
10. как Lesson Studio выбирает 1–2 artifacts по роли.

## 24. Итоговая формула

```text
learn-anything не хранит и не таскает источники.
Он управляет учебной логикой, manifests, citations и prompts.

NotebookLM хранит/индексирует источники по ссылкам.
NotebookLM отдаёт grounded retrieval, timestamps, deep links и artifacts.

Remote learn-anything общается с локальным NotebookLM MCP через SSH reverse HTTP endpoint.
```
