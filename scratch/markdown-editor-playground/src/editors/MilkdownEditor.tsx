import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import { useEffect, useRef } from 'react'
import { milkdownFrontmatter } from './milkdownFrontmatter'
import { milkdownTopBarConfig } from './milkdownTopBar'
import type { EditorAdapterProps } from './types'

const topBarLabels = [
  'Bold',
  'Italic',
  'Strikethrough',
  'Inline code',
  'Bullet list',
  'Numbered list',
  'Task list',
  'Link',
  'Image',
  'Table',
  'Code block',
  'Math block',
  'Blockquote',
  'Horizontal rule',
]

function labelCrepeControls(root: HTMLElement) {
  root
    .querySelector('.ProseMirror')
    ?.setAttribute('aria-label', 'Milkdown Markdown editor')

  root.querySelectorAll<HTMLButtonElement>('.top-bar-item').forEach((button, index) => {
    const label = topBarLabels[index]
    if (label) button.setAttribute('aria-label', label)
  })

  root
    .querySelector<HTMLButtonElement>(
      '[data-role="x-line-drag-handle"] > .add-button',
    )
    ?.setAttribute('aria-label', 'Add table column')
  root
    .querySelector<HTMLButtonElement>(
      '[data-role="y-line-drag-handle"] > .add-button',
    )
    ?.setAttribute('aria-label', 'Add table row')
}

export default function MilkdownEditor({
  initialValue,
  onChange,
}: EditorAdapterProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let created = false
    const accessibilityObserver = new MutationObserver(() => {
      labelCrepeControls(host)
    })
    accessibilityObserver.observe(host, { childList: true, subtree: true })

    const crepe = new Crepe({
      root: host,
      defaultValue: initialValue,
      features: {
        [Crepe.Feature.TopBar]: true,
      },
      featureConfigs: {
        [Crepe.Feature.TopBar]: milkdownTopBarConfig,
      },
    })

    crepe.editor.use(milkdownFrontmatter)

    crepe.on((listener) => {
      listener.markdownUpdated((_context, markdown, previousMarkdown) => {
        if (markdown !== previousMarkdown) {
          onChangeRef.current(markdown)
        }
      })
    })

    void crepe.create().then(() => {
      created = true
      if (cancelled) {
        void crepe.destroy()
      } else {
        labelCrepeControls(host)
        onChangeRef.current(crepe.getMarkdown())
      }
    })

    return () => {
      cancelled = true
      accessibilityObserver.disconnect()
      if (created) void crepe.destroy()
    }
  }, [initialValue])

  return <div className="adapter-host rich-editor milkdown-host" ref={hostRef} />
}
