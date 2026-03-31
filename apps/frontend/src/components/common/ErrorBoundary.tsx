// Enhanced Error Boundary Component for API Error Handling
// SCRUM-85: Configure Frontend API Client with Error Handling

import React, { Component, ReactNode, ErrorInfo } from 'react';

// Type definition for API errors
interface ApiError extends Error {
  code?: string;
  retryable?: boolean;
  statusCode?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | ApiError | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error | ApiError, retry: () => void, retryCount: number) => ReactNode;
  onError?: (error: Error | ApiError, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private maxRetries: number;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.maxRetries = props.maxRetries || 3;
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('🛑 ErrorBoundary caught an error:', error);
    console.error('📊 Error Info:', errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
      retryCount: this.state.retryCount + 1
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error to monitoring service (if implemented)
    this.reportErrorToService(error, errorInfo);
  }

  private reportErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Here you would typically send the error to a monitoring service
    // like Sentry, LogRocket, or your own error tracking service
    
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: localStorage.getItem('user_id') || 'anonymous'
    };

    // In development, just log to console
    if (import.meta.env.MODE === 'development') {
      console.group('🔍 Error Report');
      console.table(errorReport);
      console.groupEnd();
    } else {
      // In production, send to error reporting service
      // Example: Sentry.captureException(error, { contexts: { errorInfo } });
    }
  };

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      console.log(`🔄 Retrying... (${this.state.retryCount + 1}/${this.maxRetries})`);
      
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1
      });
    } else {
      console.warn('⚠️ Maximum retry attempts reached');
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private renderDefaultFallback = (error: Error | ApiError, retryCount: number) => {
    const isApiError = 'code' in error;
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h2 className="text-lg font-semibold text-gray-900 text-center mb-2">
            {isApiError ? 'Connection Issue' : 'Something went wrong'}
          </h2>
          
          <p className="text-sm text-gray-600 text-center mb-4">
            {isApiError 
              ? (error as ApiError).message 
              : 'An unexpected error occurred. Please try again.'
            }
          </p>

          {isApiError && (
            <div className="bg-gray-50 rounded-md p-3 mb-4">
              <div className="flex items-center text-xs text-gray-500">
                <span className="font-medium">Error Code:</span>
                <span className="ml-2 px-2 py-1 bg-gray-200 rounded font-mono">
                  {(error as ApiError).code}
                </span>
              </div>
              {(error as ApiError).retryable && (
                <div className="mt-2 text-xs text-green-600 flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  This error can be retried
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-3">
            {retryCount < this.maxRetries && (
              <button
                onClick={this.handleRetry}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                🔄 Try Again
              </button>
            )}
            
            <button
              onClick={this.handleReload}
              className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              🔄 Reload Page
            </button>
          </div>

          {import.meta.env.MODE === 'development' && (
            <details className="mt-4">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                🔧 Development Details
              </summary>
              <pre className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto max-h-32">
                {error.stack || JSON.stringify(error, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided, otherwise use default
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry, this.state.retryCount);
      }

      return this.renderDefaultFallback(this.state.error, this.state.retryCount);
    }

    return this.props.children;
  }
}

// Higher-order component for easy error boundary wrapping
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

// Hook for handling API errors in functional components
export function useErrorHandler() {
  const handleError = React.useCallback((error: ApiError | Error, context?: string) => {
    console.error(`🚨 Error in ${context || 'component'}:`, error);

    // Emit custom event that can be caught by error boundaries or global handlers
    const errorEvent = new CustomEvent('app:error', {
      detail: { error, context, timestamp: new Date().toISOString() }
    });
    
    window.dispatchEvent(errorEvent);
  }, []);

  const handleApiError = React.useCallback((error: ApiError, context?: string) => {
    // Handle specific API error types
    switch (error.code) {
      case 'NETWORK_ERROR':
        // Maybe show a toast notification
        console.warn('📡 Network issue detected');
        break;
      case 'TIMEOUT':
        console.warn('⏰ Request timed out');
        break;
      case 'UNAUTHORIZED':
        console.warn('🔐 Authentication issue');
        // Redirect to login could be handled here
        break;
      case 'RATE_LIMITED':
        console.warn('🐌 Rate limit exceeded');
        break;
      default:
        console.error('🚨 API Error:', error.message);
    }

    handleError(error, context);
  }, [handleError]);

  return { handleError, handleApiError };
}

export default ErrorBoundary;


