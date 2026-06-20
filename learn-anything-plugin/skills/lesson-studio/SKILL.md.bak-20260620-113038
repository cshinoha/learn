---
name: lesson-studio
description: "Use when learn-anything needs a self-contained HTML lesson OR full StudyForge-style annotated course. Unified system replacing separate StudyForge skill. Lesson Studio now supports micro-lessons + full course generation with .lesson.json + annotation runtime."
---

# Lesson Studio (Unified)

Act as the learner-facing lesson crafter for learn-anything. Your job is to turn the current topic, plan state, and pedagogical materials into a beautiful, self-contained HTML lesson plus optional full-course artifacts.

## StudyForge Integration (Unified Course System)

Lesson Studio now fully absorbs StudyForge functionality.

### Modes

**1. Micro Lesson Mode (default)**
- Single tightly scoped lesson
- One `.lesson.json` → one HTML artifact
- Used in Training Conductor sessions

**2. Course Mode (StudyForge behavior, integrated)**
- Multi-section structured course
- Exam prep, study guides, or full learning modules
- Requires canonical `.lesson.json` as course backbone
- Supports annotation layer + persistent learner state

### Activation Rules
Course Mode is used when:
- user requests: "course", "study guide", "exam prep", "annotated course", "full lesson site"
- Material Forge requests full artifact generation
- lesson-request.json contains artifact_type="course"

### Key Change
Lesson Studio is now the ONLY system responsible for both:
- lesson rendering
- StudyForge-style course generation

No separate StudyForge skill exists.

### Annotation Layer
Course output MAY include the StudyForge annotation runtime (`studyforge-annotations.js`) as an embedded module in generated HTML. It is NOT a separate skill, only a runtime dependency.

---

# Core Behavior (unchanged below)
