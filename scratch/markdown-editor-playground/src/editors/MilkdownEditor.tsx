import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/frame.css'
import { useEffect, useRef } from 'react'
import type { EditorAdapterProps } from './types'

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
    if (!hostRef.current) return

    let cancelled = false
    let created = false
    const crepe = new Crepe({
      root: hostRef.current,
      defaultValue: initialValue,
    })

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
        onChangeRef.current(crepe.getMarkdown())
      }
    })

    return () => {
      cancelled = true
      if (created) void crepe.destroy()
    }
  }, [initialValue])

  return <div className="adapter-host rich-editor milkdown-host" ref={hostRef} />
}
