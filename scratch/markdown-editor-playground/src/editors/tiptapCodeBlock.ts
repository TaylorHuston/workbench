import { mergeAttributes } from '@tiptap/core'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import javascript from 'highlight.js/lib/languages/javascript'
import plaintext from 'highlight.js/lib/languages/plaintext'
import typescript from 'highlight.js/lib/languages/typescript'
import { createLowlight } from 'lowlight'

const lowlight = createLowlight({
  javascript,
  js: javascript,
  jsx: javascript,
  plaintext,
  text: plaintext,
  typescript,
  ts: typescript,
  tsx: typescript,
})

export const TiptapCodeBlock = CodeBlockLowlight.extend({
  renderHTML({ node, HTMLAttributes }) {
    const language =
      node.attrs.language || this.options.defaultLanguage || 'text'

    return [
      'pre',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-language': language,
      }),
      [
        'code',
        {
          class: `${this.options.languageClassPrefix}${language}`,
        },
        0,
      ],
    ]
  },
}).configure({
  lowlight,
  defaultLanguage: 'text',
  enableTabIndentation: true,
  HTMLAttributes: {
    class: 'tiptap-code-block',
  },
})
