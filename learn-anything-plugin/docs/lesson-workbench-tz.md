# ТЗ: Lesson Workbench для learn-anything

Дата: 2026-06-13  
Статус: проектный контракт для реализации

## 1. Цель

Расширить `learn-anything` так, чтобы урок мог существовать не только как сгенерированный HTML, а как структурированный `.lesson.json`, который:

1. создаётся `Lesson Studio`;
2. рендерится `Lesson Workbench` в HTML/веб-представление;
3. принимает действия пользователя: комментарии, аннотации, ответы, выборы, оценки сложности, заметки;
4. отправляет отдельный feedback-файл в `Training Conductor`;
5. позволяет `Training Conductor` решить, продолжать ли обучение через новый урок или выбрать другой учебный путь.

HTML — только один из вариантов представления. Канонический источник урока — `.lesson.json`.

## 2. Роли компонентов

### Lesson Studio

Создаёт исходный `.lesson.json` из учебного контекста, материалов и запроса на урок.

### Lesson Workbench / Renderer

Открывает `.lesson.json`, рендерит его в удобное представление и собирает действия пользователя.

Renderer не является источником педагогической логики. Он отвечает за:

- рендер блоков;
- вычисление canonical text для каждого блока;
- вычисление offsets для аннотаций;
- формирование `lesson-feedback.json`.

### Training Conductor

Получает feedback ученика, анализирует его по своим учебным правилам и выбирает следующий шаг. Возможные следующие шаги шире текущей задачи:

- продолжить в CLI/chat;
- создать Anki-карточки;
- задать вопрос;
- обновить тренировку;
- создать новый урок.

В рамках этого ТЗ описан только случай, когда `Training Conductor` решает продолжить через lesson/workbench path и создаётся новая версия `.lesson.json`.

## 3. Версионирование и размещение файлов

Разные файлы — разные версии урока.

Рекомендуемая структура:

```text
learn-anything/<skill-slug>/teach/lessons/<topic-slug>/
  v001.lesson.json
  v001.feedback.json
  v002.lesson.json
  v002.feedback.json
```

Если для одной темы существует несколько разных уроков, путь должен включать дополнительный ID:

```text
learn-anything/<skill-slug>/teach/lessons/<topic-slug>-<lesson-id>/
```

Feedback хранится рядом с версией урока, к которой он относится.

## 4. `.lesson.json`: общий формат

Минимальные top-level поля:

```json
{
  "topic": "thread-dump-http-response-wait",
  "title": "Thread dump → HTTP response wait",
  "source": "lesson-studio",
  "created_at": "2026-06-13T00:00:00Z",
  "blocks": []
}
```

### Поля

- `topic` — slug темы урока.
- `title` — человекочитаемый заголовок.
- `source` — кто создал файл, например `lesson-studio` или `training-conductor`.
- `created_at` — ISO datetime создания файла.
- `blocks` — ordered array учебных блоков.

## 5. Блоки урока

Базовая модель блока:

```json
{
  "order": 1,
  "type": "..."
}
```

Блоки используют discriminated union: общими являются `order` и `type`, остальные поля зависят от `type`.

### Правила

1. `order` — позиция блока в конкретной версии урока и основной якорь на блок.
2. LLM не обязана генерировать технические `id` / `block_id`.
3. Renderer может создавать любые runtime anchors, но они не являются частью канонического `.lesson.json`.
4. Layout не хранится в `.lesson.json`.
5. Связи между блоками не хранятся.
6. Каждый block type сам определяет свои поля.

## 6. Типы блоков v1

v1 должен покрыть пример dual-coding урока `thread-dump-http-dual-coding.html`, но быть шире для обучения.

Минимальный широкий набор:

- `title`
- `intro`
- `explanation`
- `rule`
- `code_trace`
- `diagram`
- `legend`
- `recall_question`
- `quiz`
- `checklist`
- `misconception`
- `free_note`

### `title`

```json
{
  "order": 1,
  "type": "title",
  "content": "Thread dump → почему это ожидание HTTP response headers"
}
```

### `intro`

```json
{
  "order": 2,
  "type": "intro",
  "content": "Цель — читать frames, а не угадывать."
}
```

### `explanation`

```json
{
  "order": 3,
  "type": "explanation",
  "content": "DefaultHttpResponseParser.parseHead разбирает начало HTTP response: status line и headers.",
  "citation_refs": ["cit_abc123"]
}
```

`citation_refs` опциональны. Детали citations остаются в существующем `citations.jsonl`.

### `rule`

```json
{
  "order": 4,
  "type": "rule",
  "statement": "Если stack trace дошёл до socketRead0, поток ждёт bytes из сети.",
  "examples": [
    "SocketInputStream.socketRead0",
    "SocketInputStream.read"
  ]
}
```

### `code_trace`

```json
{
  "order": 5,
  "type": "code_trace",
  "language": "text",
  "content": "at java.net.SocketInputStream.socketRead0...\nat org.apache.http.impl.conn.DefaultHttpResponseParser.parseHead...",
  "highlights": [
    {
      "start": 12,
      "end": 48,
      "label": "network-wait",
      "tone": "danger"
    }
  ]
}
```

`highlights` используют ranges внутри `content`.

### `diagram`

Diagram — составной блок. Nodes и edges живут внутри одного блока, а не отдельными lesson blocks.

```json
{
  "order": 6,
  "type": "diagram",
  "title": "Как читать ожидание HTTP response",
  "nodes": [
    {
      "key": "tomcat-thread",
      "label": "Tomcat request thread",
      "text": "http-nio-8080-exec-1 обрабатывает входящий HTTP request."
    },
    {
      "key": "socket",
      "label": "Network socket",
      "text": "socketRead0 означает ожидание bytes из сети."
    }
  ],
  "edges": [
    {
      "from": "tomcat-thread",
      "to": "socket",
      "label": "eventually waits at"
    }
  ]
}
```

### `legend`

```json
{
  "order": 7,
  "type": "legend",
  "items": [
    {
      "label": "socketRead0",
      "meaning": "ждём сеть",
      "tone": "danger"
    },
    {
      "label": "parseHead/readLine",
      "meaning": "ждём HTTP response head",
      "tone": "warning"
    }
  ]
}
```

### `recall_question`

```json
{
  "order": 8,
  "type": "recall_question",
  "prompt": "Какой frame показывает ожидание сети?"
}
```

### `quiz`

```json
{
  "order": 9,
  "type": "quiz",
  "prompt": "Что показывает DefaultHttpResponseParser.parseHead?",
  "options": [
    { "key": "a", "text": "Чтение HTTP response head" },
    { "key": "b", "text": "Запуск Tomcat thread" }
  ]
}
```

Answer key можно не хранить в learner-facing файле, если Workbench не должен раскрывать правильный ответ. Если нужен self-check режим, допускается отдельное поле `answer_key`.

### `checklist`

```json
{
  "order": 10,
  "type": "checklist",
  "items": [
    "Найти нижний network frame",
    "Найти HTTP parser frame",
    "Найти application frame, который вызвал внешний сервис"
  ]
}
```

### `misconception`

```json
{
  "order": 11,
  "type": "misconception",
  "claim": "RUNNABLE всегда значит, что поток активно работает на CPU.",
  "correction": "В thread dump RUNNABLE может включать native socket read wait."
}
```

### `free_note`

```json
{
  "order": 12,
  "type": "free_note",
  "content": "Если таких traces много, проверяй latency внешнего сервиса и timeouts."
}
```

## 7. Annotation text и offsets

Annotations ссылаются на блок через `order`.

Если annotation привязана к фрагменту текста, она использует:

```json
{
  "order": 5,
  "action": "annotation",
  "start": 12,
  "end": 48,
  "note": "Это место непонятно."
}
```

`start` и `end` считаются относительно canonical text всего блока.

Renderer обязан для каждого block type иметь функцию условного вида:

```text
toAnnotationText(block) -> string
```

Именно по результату этой функции считаются `start` / `end`.

Не нужно хранить `selected_text`, потому что:

- текст не должен меняться внутри той же версии файла;
- если текст изменился, это уже другая версия урока;
- feedback относится к конкретному lesson file.

## 8. Feedback файл

Workbench создаёт отдельный feedback-файл рядом с версией урока.

Минимальный формат:

```json
{
  "lesson_file": "v001.lesson.json",
  "created_at": "2026-06-13T00:00:00Z",
  "learner_summary": "Пользователь отметил непонятное место про parseHead.",
  "actions": []
}
```

### Top-level поля

- `lesson_file` — имя/путь исходной версии урока.
- `created_at` — ISO datetime создания feedback.
- `learner_summary` — короткая сводка Workbench по действиям пользователя.
- `actions` — ordered список действий пользователя.

## 9. Feedback actions v1

В v1 нет прямых edit operations `delete` и `replace`.

Допустимые actions:

- `comment`
- `annotation`
- `highlight`
- `answer`
- `choice`
- `difficulty`
- `insert_note`

### `comment`

Комментарий ко всему блоку. Не привязан к диапазону текста.

```json
{
  "order": 3,
  "action": "comment",
  "note": "Этот блок слишком резко вводит термин parseHead."
}
```

### `annotation`

Аннотация к диапазону текста внутри canonical block text.

```json
{
  "order": 5,
  "action": "annotation",
  "start": 120,
  "end": 153,
  "note": "Надо объяснить, почему это именно headers."
}
```

### `highlight`

Пользовательское выделение важного места.

```json
{
  "order": 5,
  "action": "highlight",
  "start": 12,
  "end": 48,
  "reason": "important"
}
```

### `answer`

Свободный ответ пользователя.

```json
{
  "order": 8,
  "action": "answer",
  "answer": "socketRead0 показывает ожидание сети"
}
```

### `choice`

Выбор одного или нескольких вариантов.

```json
{
  "order": 9,
  "action": "choice",
  "choices": ["a"]
}
```

### `difficulty`

Оценка сложности блока или урока.

```json
{
  "order": 3,
  "action": "difficulty",
  "rating": 4
}
```

Scale для `rating` должен быть зафиксирован renderer-ом. Рекомендуемый scale: `1..5`, где `1` — очень легко, `5` — очень трудно.

### `insert_note`

Пользователь предлагает добавить заметку/пример/уточнение рядом с блоком.

```json
{
  "order": 4,
  "action": "insert_note",
  "note": "Добавить пример с hanging payment service."
}
```

## 10. Context для Training Conductor

Используется adaptive context.

Workbench rules формируют первичный пакет для `Training Conductor`:

1. всегда передать `lesson-feedback.json`;
2. передать ссылку на исходный `.lesson.json`;
3. не передавать весь текст урока по умолчанию;
4. добавить context slice только по правилам Workbench.

Рекомендуемая эвристика v1:

- для `answer`, `choice`, `difficulty` — достаточно action + referenced block order;
- для `comment`, `annotation`, `highlight`, `insert_note` — добавить touched block;
- если action относится к boundary case в начале/конце блока, можно добавить соседний block;
- full lesson context используется только если Conductor явно решает, что без него нельзя.

## 11. Создание следующей версии урока

Если `Training Conductor` решает продолжить обучение через lesson path, результатом должен быть полный новый `.lesson.json`.

Пример:

```text
v001.lesson.json
v001.feedback.json
v002.lesson.json
```

Новая версия содержит полный `blocks[]`, а не только patch или continuation.

Внутри Conductor может использовать patch/context slice для экономии, но persisted artifact — полный `.lesson.json`.

## 12. Отличие от open-plan-annotator

`open-plan-annotator` работает так:

```text
markdown plan -> parsed markdown blocks -> blockIndex + startOffset/endOffset -> serialized feedback
```

Lesson Workbench должен работать так:

```text
.lesson.json semantic blocks -> renderer canonical text -> order + start/end -> lesson-feedback.json
```

Ключевое отличие:

- open-plan-annotator аннотирует markdown-план;
- Lesson Workbench аннотирует учебные semantic blocks;
- якорь блока — `order`, а не LLM-generated `id`;
- текстовый range считается по renderer canonical text;
- feedback — отдельный файл, а не часть урока.

## 13. Что не входит в это ТЗ

- Полная логика `Training Conductor`.
- Все возможные учебные каналы после feedback.
- Anki generation.
- CLI/chat training mode.
- Dashboard updates.
- Реализация UI.
- Полная JSON Schema.

Это ТЗ фиксирует контракт между `.lesson.json`, Lesson Workbench feedback и lesson-path продолжением обучения.
