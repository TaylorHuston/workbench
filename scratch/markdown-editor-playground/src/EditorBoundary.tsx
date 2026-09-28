import { Component, type ErrorInfo, type ReactNode } from 'react'

interface EditorBoundaryProps {
  children: ReactNode
  editorName: string
}

interface EditorBoundaryState {
  error: Error | null
}

export class EditorBoundary extends Component<
  EditorBoundaryProps,
  EditorBoundaryState
> {
  state: EditorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): EditorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${this.props.editorName} failed to render`, error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="editor-crash" role="alert">
          <strong>{this.props.editorName} could not load this fixture.</strong>
          <p>{this.state.error.message}</p>
        </div>
      )
    }

    return this.props.children
  }
}
