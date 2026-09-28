# Field observations

The sample lives in a nested directory so the playground exercises a small, realistic fixture tree rather than one hard-coded string.

## Formatting pressure

A paragraph can contain **bold with _nested italic_ text**, an escaped \*asterisk\*, and a hard  
line break.

> [!NOTE]
> Obsidian-style callouts are useful source-fidelity tests because most rich-text schemas do not understand them.

### Mixed list

- Alpha
  1. one
  2. two
- Beta
  - child
    - grandchild

### Raw details

<details>
  <summary>Plain HTML inside Markdown</summary>

  Some editors preserve this exactly; others reinterpret or remove it.
</details>

<!-- This comment should survive an exact round trip. -->

---

End of fixture.
