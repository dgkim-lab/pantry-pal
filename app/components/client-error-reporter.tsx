"use client";

import { Component, type ErrorInfo, type ReactNode, useEffect } from "react";

type ClientErrorPayload = {
  message: string;
  name?: string;
  stack?: string;
  source: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
};

function reportClientError(payload: ClientErrorPayload) {
  void fetch("/api/client-errors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}

function errorPayload(error: unknown, source: string): ClientErrorPayload {
  const value = error instanceof Error ? error : new Error(String(error));
  return {
    message: value.message || "Unknown client error",
    name: value.name,
    stack: value.stack,
    source,
    url: window.location.href,
  };
}

export class ClientErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    reportClientError({ ...errorPayload(error, "react.error-boundary"), stack: `${error instanceof Error ? error.stack ?? "" : ""}\n${info.componentStack}` });
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

export function ClientErrorReporter({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      reportClientError({
        ...errorPayload(event.error ?? event.message, "window.error"),
        lineNumber: event.lineno || undefined,
        columnNumber: event.colno || undefined,
      });
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      reportClientError(errorPayload(event.reason, "window.unhandledrejection"));
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return <ClientErrorBoundary>{children}</ClientErrorBoundary>;
}
