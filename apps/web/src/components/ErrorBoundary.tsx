import { Component } from 'react';
import type { ErrorInfo, ReactElement, ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly hasError: boolean;
}

/**
 * Last-resort boundary for a render-time crash.
 *
 * Without it a thrown error unmounts the whole tree and leaves a blank white page, which
 * tells a non-technical user nothing at all. The detail goes to the console for whoever is
 * debugging; the screen gets a sentence and a way out.
 *
 * A class component because React still offers no hook equivalent for this.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Deliberate console write: there is no error-reporting service in scope, and
    // swallowing a crash silently would make it undebuggable.
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return <CrashScreen />;
    }
    return this.props.children;
  }
}

function CrashScreen(): ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
      <p className="max-w-md text-sm text-slate-600">
        The page could not be displayed. Reloading usually fixes it — if it keeps happening, tell
        the centre office.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Reload the page
      </button>
    </div>
  );
}
