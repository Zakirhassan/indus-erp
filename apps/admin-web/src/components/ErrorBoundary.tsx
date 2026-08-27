import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface px-4">
          <div className="w-full max-w-md rounded border border-border-outline bg-white p-8 text-center shadow-sm">
            <h1 className="text-headline-md font-semibold text-primary">Something went wrong</h1>
            <p className="mt-2 text-body-sm text-ink-variant">
              An unexpected error occurred while rendering this page. You can try reloading — if the problem
              persists, contact support.
            </p>
            <Button className="mt-6" onClick={() => window.location.assign("/")}>
              Reload app
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
