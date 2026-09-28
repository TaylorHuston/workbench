import { mergeAttributes, Node } from '@tiptap/core'

const FRONTMATTER_PATTERN = /^---[\t ]*\n([\s\S]*?)\n---[\t ]*(?:\n|$)/

export const TiptapFrontmatter = Node.create({
  name: 'frontmatter',
  priority: 1_000,
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      {
        tag: 'section[data-frontmatter]',
        contentElement: '[data-frontmatter-body]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        class: 'tiptap-frontmatter',
        'data-frontmatter': '',
      }),
      [
        'div',
        {
          class: 'tiptap-frontmatter__label',
          contenteditable: 'false',
        },
        'Properties',
      ],
      ['div', { 'data-frontmatter-body': '' }, 0],
    ]
  },

  markdownTokenizer: {
    name: 'frontmatter',
    level: 'block',
    start: (source) => (source.startsWith('---') ? 0 : -1),
    tokenize: (source) => {
      const match = FRONTMATTER_PATTERN.exec(source)

      if (!match || !/^[-\w]+:[\t ]*/m.test(match[1])) {
        return undefined
      }

      return {
        type: 'frontmatter',
        raw: match[0],
        text: match[1],
      }
    },
  },

  parseMarkdown: (token, helpers) =>
    helpers.createNode(
      'frontmatter',
      {},
      token.text ? [helpers.createTextNode(token.text)] : [],
    ),

  renderMarkdown: (node, helpers) => {
    const body = helpers.renderChildren(node.content ?? [])
    return `---\n${body}\n---`
  },
})
