import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors anywhere below it so a bug shows a readable
 * message instead of a blank white page. Also logs the error to the console
 * so it's easy to spot when using dev tools.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Coach App crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-2xl mx-auto p-8 dark:text-gray-100">
          <h1 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            The app hit an error while rendering this page. Reloading may help; if it
            keeps happening, the details below are worth sharing.
          </p>
          <pre className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-xs text-gray-800 whitespace-pre-wrap overflow-x-auto dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => (window.location.href = '/')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
