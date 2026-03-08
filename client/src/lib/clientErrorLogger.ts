import { auth } from './firebase';

export type ClientErrorType =
  | 'websocket'
  | 'network'
  | 'api'
  | 'client'
  | 'form_upload'
  | 'uncategorized';

export type ClientErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

export interface ClientErrorData {
  errorType: ClientErrorType;
  severity: ClientErrorSeverity;
  message: string;
  error?: Error | any;
  context?: Record<string, any>;
  wasShownToUser?: boolean;
}

export async function logClientError(
  errorData: ClientErrorData,
  user?: {
    uid?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }
): Promise<void> {
  try {
    const currentUser = auth.currentUser;

    const userName = user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : undefined;

    const userEmail = user?.email || currentUser?.email || undefined;
    const userUid = user?.uid || currentUser?.uid || undefined;
    const stackTrace = errorData.error?.stack || undefined;

    const context = {
      ...errorData.context,
      appVersion: '1.0.0',
      errorName: errorData.error?.name,
      errorMessage: errorData.error?.message,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };

    await fetch('/api/error/log-client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        errorType: errorData.errorType,
        severity: errorData.severity,
        message: errorData.message,
        stackTrace,
        userUid,
        userName,
        userEmail,
        endpoint: window.location.pathname,
        context,
        wasShownToUser: errorData.wasShownToUser ?? true
      })
    });
  } catch (error) {
    console.error('CLIENT ERROR LOGGER: Failed to log client error:', error);
  }
}
