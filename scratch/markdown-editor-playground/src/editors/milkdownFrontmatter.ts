import { $nodeSchema, $remark } from '@milkdown/kit/utils'
import remarkFrontmatter from 'remark-frontmatter'

const remarkFrontmatterPlugin = $remark(
  'remarkFrontmatter',
  () => remarkFrontmatter,
  'yaml',
)

const frontmatterSchema = $nodeSchema('frontmatter', () => ({
  content: 'text*',
  group: 'block',
  marks: '',
  code: true,
  defining: true,
  isolating: true,
  parseDOM: [
    {
      tag: 'section[data-frontmatter]',
      contentElement: '[data-frontmatter-body]',
      preserveWhitespace: 'full',
    },
  ],
  toDOM: () => [
    'section',
    {
      class: 'milkdown-frontmatter',
      'data-frontmatter': '',
    },
    [
      'div',
      {
        class: 'milkdown-frontmatter__label',
        contenteditable: 'false',
      },
      'Properties',
    ],
    ['div', { 'data-frontmatter-body': '' }, 0],
  ],
  parseMarkdown: {
    match: ({ type }) => type === 'yaml',
    runner: (state, node, type) => {
      state.openNode(type)
      if (node.value) state.addText(node.value as string)
      state.closeNode()
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'frontmatter',
    runner: (state, node) => {
      state.addNode('yaml', undefined, node.textContent)
    },
  },
}))

export const milkdownFrontmatter = [
  ...remarkFrontmatterPlugin,
  ...frontmatterSchema,
]
