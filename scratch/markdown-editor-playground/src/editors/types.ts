import type { ComponentType, LazyExoticComponent } from 'react'

export interface EditorAdapterProps {
  initialValue: string
  onChange: (markdown: string) => void
}

export type EditorComponent = LazyExoticComponent<ComponentType<EditorAdapterProps>>

export interface EditorDefinition {
  id: string
  name: string
  foundation: string
  model: string
  note: string
  component: EditorComponent
}
