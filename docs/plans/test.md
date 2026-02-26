# Markdown Feature Test Fixture

> A single document to test headings, emphasis, lists, links, images, code, tables, quotes, footnotes, HTML, and common extensions.

---

## 1) Headings

# H1

## H2

### H3

#### H4

##### H5

###### H6

---

## 2) Paragraphs, line breaks, and emphasis

This is a normal paragraph with **bold**, _italic_, **_bold italic_**, ~~strikethrough~~, and `inline code`.

This line ends with two spaces for a hard break.
This should appear on the next line.

Use escaped characters: \*not italic\*, \#not heading, \[not link\].

A literal backtick example: ``code with `backtick` inside``.

---

## 3) Blockquotes

> Simple blockquote.
>
> > Nested blockquote.
> >
> > - With a list item
> > - And another one

> Blockquote with **formatting** and a [link](https://example.com).

---

## 4) Lists

### Unordered list

- Item A
- Item B
  - Nested B.1
  - Nested B.2
    - Deep nested B.2.a
- Item C

### Ordered list

1. First
2. Second
3. Third
4. Third.a
5. Third.b

### Ordered list (non-1 start)

7. Starts at seven
8. Then eight

### Task list (GFM)

- [x] Completed task
- [ ] Incomplete task
  - [x] Nested completed
  - [ ] Nested incomplete

---

## 5) Links and autolinks

Inline link: [Markdown Guide](https://www.markdownguide.org)

Reference-style link: [CommonMark Spec][commonmark]

Autolink: <https://github.com>

Email autolink: <test@example.com>

[commonmark]: https://spec.commonmark.org/

---

## 6) Images

![Placeholder image](https://picsum.photos/seed/markdown-test/320/180 "Optional title")

---

## 7) Horizontal rule

---

## 8) Code blocks

### Fenced code (plain)

```text
Plain text code block
with multiple lines.
```

### Fenced code (TypeScript)

```ts
type User = { id: string; name: string };

const greet = (user: User): string => {
	return `Hello, ${user.name}!`;
};

console.log(greet({ id: "u1", name: "Ada" }));
```

### Fenced code (Bash)

```bash
bun install
bun run check
bunx turbo -F apps/web typecheck
```

### Fenced code (diff)

```diff
- const enabled = false;
+ const enabled = true;
```

### Indented code block

    This is an indented code block.
    It uses 4 leading spaces.

---

## 9) Tables (GFM)

| Feature      | Syntax Example | Supported? |
| ------------ | -------------- | ---------- |
| Bold         | `**bold**`     | Yes        |
| Italic       | `*italic*`     | Yes        |
| Inline code  | `` `code` ``   | Yes        |
| Escaped pipe | `a \| b`       | Maybe      |

Alignment test:

| Left | Center | Right |
| :--- | :----: | ----: |
| a    |   b    |     c |
| 1    |   2    |     3 |

---

## 10) Footnotes (extension)

Here is a statement with a footnote.[^note1]
And another reference to the same footnote.[^note1]

[^note1]: This is the footnote content.

---

## 11) Definition list (extension, not in core CommonMark)

Term 1
: Definition for term 1

Term 2
: First definition for term 2
: Second definition for term 2

---

## 12) Inline HTML (allowed in many Markdown parsers)

<kbd>Ctrl</kbd> + <kbd>K</kbd>

<details>
  <summary>Click to expand</summary>
  Hidden content inside a native HTML `<details>` block.
</details>

<div style="border:1px solid #999; padding:8px; border-radius:6px;">
  HTML block with inline styles (sanitizers may strip this).
</div>

---

## 13) Optional math (extension)

Inline math: $E = mc^2$

Block math:

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

---

## 14) Mixed stress test paragraph

**Bold _nested italic_ bold**, ~~strike with `code`~~, [link](https://example.com), emoji 😀, and escaped chars \* \_ \` \| all in one line.

End of fixture.
