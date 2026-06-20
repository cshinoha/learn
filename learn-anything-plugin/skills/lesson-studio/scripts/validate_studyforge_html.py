#!/usr/bin/env python3
"""Validate StudyForge-style HTML for Lesson Studio UI contracts.

This is a lightweight static check. It intentionally checks generated HTML,
not source secrecy: answers may exist in source, but must not be visible in the
initial learner interface.
"""

from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


ASSUMED_CONTEXT_PATTERNS = [
    r"\bв\s+вашей\s+системе\b",
    r"\bв\s+вашем\s+проекте\b",
    r"\bв\s+вашем\s+приложении\b",
    r"\bв\s+вашем\s+сервисе\b",
    r"\bв\s+вашей\s+команде\b",
    r"\byour\s+system\b",
    r"\byour\s+project\b",
    r"\byour\s+application\b",
    r"\byour\s+service\b",
    r"\byour\s+team\b",
]

VIRTUAL_FILE_PATTERNS = [
    r"\bВиртуальный\s+файл\s*:",
    r"\bVirtual\s+file\s*:",
]

ANSWER_PLACEHOLDER_PATTERNS = [
    r"\bjoin\s*\(",
    r"\bvolatile\b",
    r"\bsynchronized\b",
    r"\bAtomicInteger\b",
    r"\bCompletableFuture\b",
    r"\bnotifyAll\s*\(",
    r"\bsignalAll\s*\(",
    r"->",
    r";",
]

VISIBLE_ANSWER_PATTERNS = [
    r"Правильный\s+ответ\s*:",
    r"Correct\s+answer\s*:",
]


class StudyForgeHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.errors: list[str] = []
        self.stack: list[tuple[str, dict[str, str]]] = []
        self.in_hidden_depth = 0
        self.text_visible: list[str] = []
        self.textareas: list[dict[str, str]] = []
        self.learner_tools_found = False
        self.learner_menu_toggle_found = False
        self.learner_menu_panel_found = False
        self.learner_tools_style = ""
        self.current_textarea: dict[str, str] | None = None
        self.current_textarea_text: list[str] = []

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        attrs = {k.lower(): (v or "") for k, v in attrs_list}
        self.stack.append((tag, attrs))

        hidden = "hidden" in attrs or attrs.get("aria-hidden") == "true" or "display:none" in attrs.get("style", "").replace(" ", "").lower()
        if hidden:
            self.in_hidden_depth += 1

        if attrs.get("id") == "sfLearnerTools":
            self.learner_tools_found = True
            self.learner_tools_style = attrs.get("style", "")
        if attrs.get("id") == "sfLearnerMenuToggle":
            self.learner_menu_toggle_found = True
        if attrs.get("id") == "sfLearnerMenuPanel":
            self.learner_menu_panel_found = True

        if tag in {"input", "textarea"}:
            placeholder = attrs.get("placeholder", "")
            for pattern in ANSWER_PLACEHOLDER_PATTERNS:
                if re.search(pattern, placeholder, re.IGNORECASE):
                    self.errors.append(f"answer-like placeholder in <{tag}>: {placeholder!r}")

        if tag == "details" and "open" in attrs:
            self.errors.append("<details open> found; solution/reveal blocks must not be open initially")

        if tag == "textarea":
            self.current_textarea = attrs
            self.current_textarea_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "textarea" and self.current_textarea is not None:
            text = "".join(self.current_textarea_text)
            data = dict(self.current_textarea)
            data["__text__"] = text
            self.textareas.append(data)
            self.current_textarea = None
            self.current_textarea_text = []

        if self.stack:
            start_tag, attrs = self.stack.pop()
            hidden = "hidden" in attrs or attrs.get("aria-hidden") == "true" or "display:none" in attrs.get("style", "").replace(" ", "").lower()
            if hidden and self.in_hidden_depth > 0:
                self.in_hidden_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.current_textarea is not None:
            self.current_textarea_text.append(data)
            return
        if self.in_hidden_depth == 0:
            self.text_visible.append(data)


def validate(path: Path) -> list[str]:
    html = path.read_text(encoding="utf-8", errors="replace")
    parser = StudyForgeHTMLParser()
    parser.feed(html)
    errors = list(parser.errors)

    visible = " ".join(parser.text_visible)
    visible = re.sub(r"\s+", " ", visible)

    for pattern in ASSUMED_CONTEXT_PATTERNS:
        if re.search(pattern, visible, re.IGNORECASE):
            errors.append(f"assumed learner context visible in UI: /{pattern}/")

    for pattern in VIRTUAL_FILE_PATTERNS:
        if re.search(pattern, visible, re.IGNORECASE):
            errors.append(f"obsolete virtual-file label visible in UI: /{pattern}/")

    for pattern in VISIBLE_ANSWER_PATTERNS:
        if re.search(pattern, visible, re.IGNORECASE):
            errors.append(f"visible answer reveal in initial UI: /{pattern}/")

    if not parser.learner_tools_found:
        errors.append("missing #sfLearnerTools")
    if not parser.learner_menu_toggle_found:
        errors.append("missing #sfLearnerMenuToggle")
    if not parser.learner_menu_panel_found:
        errors.append("missing #sfLearnerMenuPanel")

    css_scan = html.lower()
    overlay_patterns = [
        r"#sflearnertools\s*\{[^}]*position\s*:\s*(fixed|sticky|absolute)",
        r"\.sf-learner-tools\s*\{[^}]*position\s*:\s*(fixed|sticky|absolute)",
    ]
    for pattern in overlay_patterns:
        if re.search(pattern, css_scan, re.DOTALL):
            errors.append("learner tools menu uses overlay positioning; use normal document flow")

    inline_style = parser.learner_tools_style.lower()
    if re.search(r"position\s*:\s*(fixed|sticky|absolute)", inline_style):
        errors.append("#sfLearnerTools inline style uses overlay positioning")

    # Bug Hunt heuristic: if the visible text asks to fix code, require at least one code-like textarea.
    if re.search(r"bug\s+hunt|исправьте\s+код|найдите\s+и\s+исправьте|лабораторная", visible, re.IGNORECASE):
        has_code_textarea = any(
            ("code" in (ta.get("class", "") + " " + ta.get("id", "") + " " + ta.get("data-sf-answer", "")).lower())
            and len(ta.get("__text__", "")) > 40
            for ta in parser.textareas
        )
        if not has_code_textarea:
            errors.append("lab appears to ask for code fixing but no editable code textarea was found")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate StudyForge HTML generated by Lesson Studio")
    parser.add_argument("html_file", type=Path)
    args = parser.parse_args()

    errors = validate(args.html_file)
    if errors:
        print(f"FAIL: {args.html_file}")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"PASS: {args.html_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
