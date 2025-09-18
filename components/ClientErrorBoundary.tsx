'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Custom error boundary to handle hydration and other client-side errors gracefully
 */
export default class ClientErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Check if this is a hydration error that we can safely ignore
    const isHydrationError = error.message.includes('Extra attributes from the server') ||
                           error.message.includes('data-new-gr-c-s-check-loaded') ||
                           error.message.includes('data-gr-ext-installed') ||
                           error.message.includes('Hydration failed');
    
    if (isHydrationError) {
      console.warn('Suppressed hydration warning from browser extension:', error.message);
      return { hasError: false }; // Don't treat as error
    }
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Check if this is a browser extension related error
    const isBrowserExtensionError = error.message.includes('data-new-gr-c-s-check-loaded') ||
                                  error.message.includes('data-gr-ext-installed') ||
                                  error.message.includes('Extra attributes from the server');
    
    if (isBrowserExtensionError) {
      console.warn('Browser extension caused hydration warning - safely ignored:', error.message);
      return; // Don't log as error
    }
    
    console.error('Client Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
          <p className="text-red-600">Please refresh the page to continue.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}