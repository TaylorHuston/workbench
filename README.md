# Workbench

A public workspace for small technical examples, structured learning exercises, and exploratory code that does not need a standalone repository or the full Story-Driven Development workflow.

IMPORTANT: As a workspace, nothing in here needs to follow any of of our established branch rules, sdd-workflow, or other best practices/guidelines.

## Sections

### [`reference/`](reference/)

Curated examples intended to be useful after the original learning session. Reference material should be understandable in isolation, narrowly scoped, and maintained as the canonical example for its subject within this repository.

Current collections:

- [`algorithms/`](reference/algorithms/) — classic algorithms and data structures
- [`frameworks/`](reference/frameworks/) — canonical framework and library examples
- [`interview-prep/`](reference/interview-prep/) — programming interview exercises
- [`programming-cliffnotes/`](reference/programming-cliffnotes/) — language, syntax, and foundational tooling examples

### [`learning/`](learning/)

Code, exercises, and notes produced while following books, tutorials, and courses. Source attribution and the original structure should be preserved when useful.

Learning material is grouped by source type:

- [`books/`](learning/books/)
- [`courses/`](learning/courses/)
- [`tutorials/`](learning/tutorials/)
- [`youtube/`](learning/youtube/)

### [`scratch/`](scratch/)

In-progress experiments, spikes, proofs of concept, and disposable investigations. New unsorted experimental work belongs here by default.

A scratch project may later:

- be discarded when the question has been answered;
- move to `reference/` when it becomes a canonical example; or
- graduate to a standalone repository and the SDD workflow when it becomes a durable application or product effort.

## Repository conventions

- Keep each project self-contained and add a local README when its purpose or source is not obvious.
- Use lowercase kebab-case for new directories and general-purpose files unless a language or framework has a stronger convention.
- Do not create paths that differ only by case.
- Keep generated dependencies, local runtime state, credentials, and secrets out of Git.
- Preserve attribution and upstream licensing for material based on books, courses, tutorials, or third-party examples.

## License

Unless otherwise noted, original code in this repository is available under the MIT License. Individual learning projects may include or derive from third-party material with separate attribution or license terms; consult the nearest README or license file.
