import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('FinTrack ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('fintrack-fx-cache-v1');
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-[#090E1A] text-slate-900 dark:text-slate-100">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h1 className="text-lg font-bold tracking-tight">Something went wrong</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              FinTrack encountered a client error while rendering this view. Reloading usually
              resolves temporary network or storage issues.
            </p>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 break-words">
              {this.state.message}
            </div>
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              Reload FinTrack
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
