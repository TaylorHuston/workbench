interface FrontmatterPanelProps {
  id: string
  value: string
  onChange: (value: string) => void
}

export function FrontmatterPanel({
  id,
  value,
  onChange,
}: FrontmatterPanelProps) {
  return (
    <section className="frontmatter-panel" aria-labelledby={`${id}-label`}>
      <label className="frontmatter-panel__label" id={`${id}-label`} htmlFor={id}>
        Properties
      </label>
      <textarea
        id={id}
        value={value}
        rows={Math.max(3, value.split('\n').length)}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  )
}
