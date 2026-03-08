import { firestore } from '../firebase-admin';
import type { Query, CollectionReference, DocumentData } from 'firebase-admin/firestore';

export type ErrorType = 
  | 'registration'
  | 'payment'
  | 'approval'
  | 'queue'
  | 'api'
  | 'client'
  | 'email'
  | 'sms'
  | 'pdf'
  | 'security_alert'
  | 'workflow'
  | 'system'
  | 'database'
  | 'authentication'
  | 'validation'
  | 'form_upload'
  | 'admin_operation_error'
  | 'workflow_error'
  | 'email_error'
  | 'sms_error'
  | 'package_not_found'
  | 'manual_action'
  | 'uncategorized';

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

export interface ErrorLogData {
  errorType: ErrorType;
  severity: ErrorSeverity;
  message: string;
  stackTrace?: string;

  userLevel?: 1 | 2 | 3 | 4 | null;
  userUid?: string;
  userName?: string;
  userEmail?: string;

  endpoint?: string;
  method?: string;
  statusCode?: number;

  context?: Record<string, any>;
  wasShownToUser?: boolean;
}

interface StoredErrorLog extends ErrorLogData {
  id: string;
  timestamp: Date;
  createdAt: Date;
}

const recentErrors = new Map<string, number>();

function getErrorKey(errorData: ErrorLogData): string {
  return [
    errorData.errorType,
    errorData.message,
    errorData.userUid || 'anonymous'
  ].join('::');
}

function isDuplicate(errorData: ErrorLogData): boolean {
  const key = getErrorKey(errorData);
  const lastTime = recentErrors.get(key);
  const now = Date.now();

  if (lastTime && now - lastTime < 30000) return true;

  recentErrors.set(key, now);

  if (recentErrors.size > 1000) {
    const oldestKey = recentErrors.keys().next().value;
    if (oldestKey) recentErrors.delete(oldestKey);
  }

  return false;
}

function inferUserLevel(errorData: ErrorLogData): 1 | 2 | 3 | 4 | null {
  if (errorData.userLevel !== undefined && errorData.userLevel !== null) {
    return errorData.userLevel;
  }

  const context = errorData.context || {};
  const message = errorData.message?.toLowerCase() || '';

  if (context.doctorUid || context.doctorFirebaseUid || context.doctorName) return 2;
  if (context.adminUid || context.adminFirebaseUid) return 3;
  if (context.patientUid || context.patientFirebaseUid || context.patientName) return 1;

  if (errorData.errorType === 'approval' && context.doctorUid) return 2;

  if (message.includes('doctor') || message.includes('reviewer')) return 2;
  if (message.includes('admin')) return 3;
  if (message.includes('patient') || message.includes('applicant')) return 1;

  return null;
}

function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanObject);

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' ? cleanObject(value) : value;
    }
  }
  return cleaned;
}

export async function logError(errorData: ErrorLogData): Promise<void> {
  try {
    if (isDuplicate(errorData)) {
      console.log('ERROR LOG: Skipping duplicate error within 30 seconds');
      return;
    }

    const db = firestore;
    const now = new Date();
    const inferredUserLevel = inferUserLevel(errorData);
    const cleanedErrorData = cleanObject(errorData);

    const logEntry: Omit<StoredErrorLog, 'id'> = {
      ...cleanedErrorData,
      userLevel: errorData.userLevel ?? inferredUserLevel,
      timestamp: now,
      createdAt: now,
      wasShownToUser: errorData.wasShownToUser ?? false,
      context: cleanObject(errorData.context ?? {})
    };

    await db.collection('errorLogs').add(logEntry);

    console.log(`ERROR LOG: ${errorData.severity.toUpperCase()} - ${errorData.errorType} - ${errorData.message}`);

    if (errorData.severity === 'critical') {
      console.error('CRITICAL ERROR LOGGED:', {
        type: errorData.errorType,
        message: errorData.message,
        user: errorData.userName || errorData.userEmail || 'Unknown',
        endpoint: errorData.endpoint
      });
    }
  } catch (err) {
    console.error('ERROR LOGGER: Failed to log error:', err);
  }
}

export async function getErrorLogs(options: {
  startDate?: Date;
  endDate?: Date;
  severity?: ErrorSeverity;
  errorType?: ErrorType;
  userLevel?: number;
  userUid?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: StoredErrorLog[]; total: number }> {
  try {
    const db = firestore;
    const queryLimit = options.limit || 50;
    const offset = options.offset || 0;

    if (options.userUid) {
      const buildBaseQuery = (collection: CollectionReference<DocumentData>) => {
        let q: Query<DocumentData> = collection;
        if (options.startDate) q = q.where('timestamp', '>=', options.startDate);
        if (options.endDate) q = q.where('timestamp', '<=', options.endDate);
        if (options.severity) q = q.where('severity', '==', options.severity);
        if (options.errorType) q = q.where('errorType', '==', options.errorType);
        if (options.userLevel !== undefined) q = q.where('userLevel', '==', options.userLevel);
        return q;
      };

      const [userUidSnapshot, contextSnapshot] = await Promise.all([
        buildBaseQuery(db.collection('errorLogs'))
          .where('userUid', '==', options.userUid)
          .orderBy('timestamp', 'desc')
          .limit(queryLimit)
          .get(),
        buildBaseQuery(db.collection('errorLogs'))
          .where('context.patientUid', '==', options.userUid)
          .orderBy('timestamp', 'desc')
          .limit(queryLimit)
          .get()
      ]);

      const logMap = new Map<string, StoredErrorLog>();
      const processDoc = (doc: any) => {
        if (!logMap.has(doc.id)) {
          logMap.set(doc.id, {
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp),
            createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
          } as StoredErrorLog);
        }
      };

      userUidSnapshot.docs.forEach(processDoc);
      contextSnapshot.docs.forEach(processDoc);

      const allLogs = Array.from(logMap.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, queryLimit);

      return { logs: allLogs, total: logMap.size };
    }

    let countQuery: Query<DocumentData> | CollectionReference<DocumentData> = db.collection('errorLogs');
    let dataQuery: Query<DocumentData> | CollectionReference<DocumentData> = db.collection('errorLogs').orderBy('timestamp', 'desc');

    if (options.startDate) {
      countQuery = countQuery.where('timestamp', '>=', options.startDate);
      dataQuery = dataQuery.where('timestamp', '>=', options.startDate);
    }
    if (options.endDate) {
      countQuery = countQuery.where('timestamp', '<=', options.endDate);
      dataQuery = dataQuery.where('timestamp', '<=', options.endDate);
    }
    if (options.severity) {
      countQuery = countQuery.where('severity', '==', options.severity);
      dataQuery = dataQuery.where('severity', '==', options.severity);
    }
    if (options.errorType) {
      countQuery = countQuery.where('errorType', '==', options.errorType);
      dataQuery = dataQuery.where('errorType', '==', options.errorType);
    }
    if (options.userLevel !== undefined) {
      countQuery = countQuery.where('userLevel', '==', options.userLevel);
      dataQuery = dataQuery.where('userLevel', '==', options.userLevel);
    }

    if (offset > 0) {
      const offsetSnapshot = await dataQuery.limit(offset).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        dataQuery = dataQuery.startAfter(lastDoc);
      }
    }

    dataQuery = dataQuery.limit(queryLimit);

    const [countSnapshot, dataSnapshot] = await Promise.all([
      countQuery.count().get(),
      dataQuery.get()
    ]);

    const logs: StoredErrorLog[] = dataSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
    } as StoredErrorLog));

    return { logs, total: countSnapshot.data().count };
  } catch (err) {
    console.error('ERROR LOGGER: Failed to fetch error logs:', err);
    return { logs: [], total: 0 };
  }
}

export function createErrorContext(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('secret')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = JSON.stringify(value).substring(0, 500);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
