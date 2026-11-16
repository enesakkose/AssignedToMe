import { Component, type ReactNode } from 'react';

/** Keeps a render error from blanking the whole screen; shows what failed so it can be recovered from. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-lg text-ink">Something went wrong</p>
          <pre className="max-h-64 max-w-full overflow-auto rounded-sm bg-paper-2 p-3 text-left font-mono text-xs whitespace-pre-wrap text-error">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="rounded-control bg-paper-3 px-3 py-1 text-md text-ink-2 hover:text-ink"
            onClick={() => this.setState({ error: null })}
          >
            Dismiss
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
