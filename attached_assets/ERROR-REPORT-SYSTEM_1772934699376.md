# Error Report System — Full Implementation Guide

This document is a complete, copy-paste-ready reference for implementing the centralized error logging and reporting system used in ChronicDocs. A new project agent should be able to implement this with minimal research.

---

## Architecture Overview

```
Client (browser)
  └─ logClientError()  ──► POST /api/error/log-client-error
                                    │
Server (any route)                  │
  └─ logError()  ─────────────────► Firestore: errorLogs collection
                                    │
Admin Dashboard                     │
  └─ GET /api/admin/error-logs ◄────┘
       └─ Diagnostics.tsx (UI viewer)
```

**Storage:** Firestore collection `errorLogs` — no SQL, no external service.  
**Deduplication:** In-memory Map on the server, 30-second window.  
**Auth:** Client endpoint is public (errors happen before login). Admin fetch endpoint requires `userLevel >= 4`.

---

## 1. Server Service — `server/services/errorLogger.ts`

This is the core. Everything else calls into this.

```typescript
import { getDb } from '../firebase';
import type { Query, CollectionReference, DocumentData } from 'firebase-admin/firestore';

export type ErrorType = 
  | 'registration'
  | 'payment'
  | 'waiting_room'
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
  | 'video_consultation'
  | 'database'
  | 'authentication'
  | 'validation'
  | 'form_upload'
  | 'admin_operation_error'
  | 'workflow_error'
  | 'commission_error'
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

  // User context — all optional, auto-inferred if possible
  userLevel?: 1 | 2 | 3 | 4 | 5 | null;
  userUid?: string;
  userName?: string;
  userEmail?: string;

  // Request context
  endpoint?: string;
  method?: string;
  statusCode?: number;

  // Freeform metadata
  context?: Record<string, any>;
  wasShownToUser?: boolean;
}

interface StoredErrorLog extends ErrorLogData {
  id: string;
  timestamp: Date;
  createdAt: Date;
}

// ─── Deduplication ────────────────────────────────────────────────────────────
// Prevents the same error from being written more than once in 30 seconds.
// Keyed on: errorType + message + userUid (stack trace intentionally excluded
// because client and server traces differ for the same underlying error).

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

  // Cap map size to avoid memory leaks
  if (recentErrors.size > 1000) {
    const oldestKey = recentErrors.keys().next().value;
    if (oldestKey) recentErrors.delete(oldestKey);
  }

  return false;
}

// ─── User Level Inference ─────────────────────────────────────────────────────
// If userLevel is not explicitly passed, try to infer it from context fields
// or the error message itself. Returns null if unable to determine.

function inferUserLevel(errorData: ErrorLogData): 1 | 2 | 3 | 4 | 5 | null {
  if (errorData.userLevel !== undefined && errorData.userLevel !== null) {
    return errorData.userLevel;
  }

  const context = errorData.context || {};
  const message = errorData.message?.toLowerCase() || '';

  if (context.doctorUid || context.doctorFirebaseUid || context.doctorName) return 2;
  if (context.agentUid || context.agentFirebaseUid || context.agentName) return 3;
  if (context.patientUid || context.patientFirebaseUid || context.patientName) return 1;

  if (errorData.errorType === 'video_consultation' && !context.doctorUid) return 1;
  if (errorData.errorType === 'approval' && context.doctorUid) return 2;

  if (message.includes('doctor')) return 2;
  if (message.includes('agent')) return 3;
  if (message.includes('patient')) return 1;

  return null;
}

// ─── cleanObject ──────────────────────────────────────────────────────────────
// Firestore rejects documents with `undefined` values. Strip them recursively.

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

// ─── logError ─────────────────────────────────────────────────────────────────
// Main write function. Call this from any server route or service.

export async function logError(errorData: ErrorLogData): Promise<void> {
  try {
    if (isDuplicate(errorData)) {
      console.log('⏭️ ERROR LOG: Skipping duplicate error within 30 seconds');
      return;
    }

    const db = getDb();
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

    console.log(`📝 ERROR LOG: ${errorData.severity.toUpperCase()} - ${errorData.errorType} - ${errorData.message}`);

    if (errorData.severity === 'critical') {
      console.error('🚨 CRITICAL ERROR LOGGED:', {
        type: errorData.errorType,
        message: errorData.message,
        user: errorData.userName || errorData.userEmail || 'Unknown',
        endpoint: errorData.endpoint
      });
    }
  } catch (err) {
    console.error('❌ ERROR LOGGER: Failed to log error (ironic):', err);
  }
}

// ─── getErrorLogs ─────────────────────────────────────────────────────────────
// Fetch logs with optional filters. Used by the admin route below.

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
    const db = getDb();
    const queryLimit = options.limit || 50;
    const offset = options.offset || 0;

    // Special case: searching by userUid requires two parallel queries because
    // some logs store the UID at top level (userUid) and others store it in
    // context.patientUid. Merge and deduplicate by Firestore document ID.
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

    // Standard path — no userUid filter
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
    console.error('❌ ERROR LOGGER: Failed to fetch error logs:', err);
    return { logs: [], total: 0 };
  }
}

// ─── createErrorContext ───────────────────────────────────────────────────────
// Sanitize an object before passing it as `context`. Redacts passwords/tokens.
// Truncates nested objects to 500 chars to keep Firestore docs small.

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
```

---

## 2. Client-Side Endpoint — `server/routes/errorLogger.ts`

Receives errors posted by the browser. No auth required.

```typescript
import { Router, Request, Response } from 'express';
import { logError } from '../services/errorLogger';
import type { ErrorLogData } from '../services/errorLogger';

const router = Router();

// POST /api/error-logger/client-error
router.post('/client-error', async (req: Request, res: Response) => {
  try {
    const {
      errorType, severity, message,
      userUid, userName, userEmail, userLevel,
      endpoint, context, stackTrace
    } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    await logError({
      errorType: errorType || 'client',
      severity: severity || 'error',
      message,
      stackTrace,
      userUid: userUid || undefined,
      userName: userName || undefined,
      userEmail: userEmail || undefined,
      userLevel: userLevel || undefined,
      endpoint: endpoint || 'client-side',
      method: 'CLIENT',
      wasShownToUser: true,
      context: {
        ...context,
        source: 'client_toast_notification',
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      }
    });

    res.json({ success: true, message: 'Error logged successfully' });
  } catch (error) {
    console.error('❌ Failed to log client error:', error);
    // Never 500 — don't break UX if logging fails
    res.json({ success: false, message: 'Failed to log error' });
  }
});

export default router;
```

**Wire it into your main routes file:**

```typescript
// server/routes.ts or server/index.ts
import errorLoggerRoutes from './routes/errorLogger';
app.use('/api/error-logger', errorLoggerRoutes);

// Also register the legacy alias used by clientErrorLogger.ts:
app.post('/api/error/log-client-error', async (req, res) => {
  // forward to same logError() call — see clientErrorLogger.ts usage
});
```

---

## 3. Admin Fetch Route — inside `server/routes/admin.ts`

```typescript
import { getErrorLogs, logError } from '../services/errorLogger';

// GET /api/admin/error-logs
router.get('/error-logs', isAuthenticated, async (req, res) => {
  if (req.user!.userLevel < 4) {
    return res.status(403).json({ success: false, message: 'Access denied - admins only' });
  }

  try {
    const { startDate, endDate, severity, errorType, userLevel, userUid, limit, offset } = req.query;

    const options: any = {};
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);
    if (severity) options.severity = severity as string;
    if (errorType) options.errorType = errorType as string;
    if (userLevel !== undefined) options.userLevel = parseInt(userLevel as string);
    if (userUid) options.userUid = userUid as string;
    if (limit) options.limit = parseInt(limit as string);
    if (offset) options.offset = parseInt(offset as string);

    const result = await getErrorLogs(options);

    // Enrich: pull user info from context if not at top level
    const enrichedLogs = result.logs.map((log: any) => {
      const context = log.context || {};

      let userName = log.userName;
      if (!userName && context.patientName) userName = context.patientName;
      if (!userName && context.firstName && context.lastName) {
        userName = `${context.firstName} ${context.lastName}`;
      }

      const userEmail = log.userEmail || context.email || context.userEmail;
      const userUid = log.userUid || context.patientFirebaseUid || context.firebaseUid;

      return { ...log, userName, userEmail, userUid };
    });

    res.json({ logs: enrichedLogs, total: result.total });
  } catch (error) {
    console.error('❌ Error fetching error logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch error logs' });
  }
});
```

---

## 4. Client Error Logger — `client/src/lib/clientErrorLogger.ts`

Call this from any frontend component to log an error to the centralized system.

```typescript
import { auth } from './firebase';
import { APP_VERSION } from '../config/version'; // or hardcode a version string

export type ClientErrorType =
  | 'websocket'
  | 'video_consultation'
  | 'camera_permission'
  | 'microphone_permission'
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
      appVersion: APP_VERSION,
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
    console.error('❌ CLIENT ERROR LOGGER: Failed to log client error:', error);
  }
}
```

**Usage in a component:**

```typescript
import { logClientError } from '@/lib/clientErrorLogger';

try {
  await someOperation();
} catch (err) {
  logClientError({
    errorType: 'api',
    severity: 'error',
    message: 'Failed to submit payment form',
    error: err,
    context: { orderId: '123', step: 2 },
    wasShownToUser: true
  }, user); // pass user object from AuthContext
}
```

---

## 5. Server-Side Usage Pattern

Import and call `logError()` directly from any backend route or service:

```typescript
import { logError, createErrorContext } from '../services/errorLogger';

// Inside a route handler:
try {
  await processPayment(uid);
} catch (err: any) {
  await logError({
    errorType: 'payment',
    severity: 'critical',
    message: `Payment failed for user ${uid}: ${err.message}`,
    stackTrace: err.stack,
    userUid: uid,
    userName: `${user.firstName} ${user.lastName}`,
    userEmail: user.email,
    userLevel: 1,
    endpoint: '/api/payment/submit',
    method: 'POST',
    statusCode: 500,
    wasShownToUser: true,
    context: createErrorContext({
      amount: 53,
      packageName: 'Full Service Package',
      rawError: err.message
    })
  });
  return res.status(500).json({ message: 'Payment failed' });
}
```

**Lightweight info/audit logging (no try/catch needed):**

```typescript
await logError({
  errorType: 'manual_action',
  severity: 'info',
  message: `Admin manually reset patient profile for ${patientName}`,
  userUid: adminUid,
  userLevel: 4,
  endpoint: '/api/admin/reset-profile',
  method: 'POST',
  wasShownToUser: false,
  context: { patientUid, reason: 'security_violation_reset' }
});
```

---

## 6. Firestore Collection Schema

Collection: `errorLogs`

| Field | Type | Notes |
|---|---|---|
| `errorType` | string | One of the ErrorType union values |
| `severity` | string | `critical` / `error` / `warning` / `info` |
| `message` | string | Human-readable description |
| `stackTrace` | string? | JS stack trace if available |
| `userLevel` | number? | 1=patient, 2=doctor, 3=agent, 4=admin, 5=owner |
| `userUid` | string? | Firebase UID of affected user |
| `userName` | string? | Full name |
| `userEmail` | string? | Email address |
| `endpoint` | string? | API route or client URL path |
| `method` | string? | HTTP method or `CLIENT` |
| `statusCode` | number? | HTTP status code if applicable |
| `context` | map? | Arbitrary key/value metadata |
| `wasShownToUser` | boolean | Whether a toast/UI notification was shown |
| `timestamp` | timestamp | When the error occurred |
| `createdAt` | timestamp | Same as timestamp (redundant for legacy queries) |

**Required Firestore indexes:**

```
errorLogs: timestamp (DESC)
errorLogs: severity + timestamp (DESC)
errorLogs: errorType + timestamp (DESC)
errorLogs: userLevel + timestamp (DESC)
errorLogs: userUid + timestamp (DESC)
errorLogs: context.patientUid + timestamp (DESC)   ← needed for dual-query userUid search
```

---

## 7. Frontend Admin Viewer — Query Pattern

The admin UI fetches logs using TanStack Query. Key query structure:

```typescript
const { data, isLoading } = useQuery({
  queryKey: ['/api/admin/error-logs', filters],
  queryFn: async () => {
    const token = await auth.currentUser?.getIdToken();
    const params = new URLSearchParams();

    if (filters.startDate) params.set('startDate', filters.startDate.toISOString());
    if (filters.endDate) params.set('endDate', filters.endDate.toISOString());
    if (filters.severity !== 'all') params.set('severity', filters.severity);
    if (filters.errorType !== 'all') params.set('errorType', filters.errorType);
    if (filters.userLevel !== undefined) params.set('userLevel', String(filters.userLevel));
    params.set('limit', '50');
    params.set('offset', String(page * 50));

    const res = await fetch(`/api/admin/error-logs?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch error logs');
    return res.json(); // { logs: ErrorLog[], total: number }
  }
});
```

**Severity badge color mapping used in the UI:**

```typescript
const severityColor = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  error:    'bg-orange-100 text-orange-800 border-orange-200',
  warning:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  info:     'bg-blue-100 text-blue-800 border-blue-200'
};
```

---

## 8. Integration Checklist for a New Project

- [ ] Copy `server/services/errorLogger.ts` verbatim — only change `getDb()` import to match your Firebase setup
- [ ] Copy `server/routes/errorLogger.ts` verbatim
- [ ] Copy `client/src/lib/clientErrorLogger.ts` — update the auth import and APP_VERSION
- [ ] Register `app.use('/api/error-logger', errorLoggerRoutes)` in your main routes file
- [ ] Register `app.post('/api/error/log-client-error', ...)` as an alias (used by clientErrorLogger.ts)
- [ ] Add `router.get('/error-logs', ...)` to your admin routes file
- [ ] Create the Firestore composite indexes listed in Section 6
- [ ] Add your custom `ErrorType` values to the union in `errorLogger.ts` — the base set covers most cases
- [ ] Call `logError()` in server catch blocks for any operation that matters
- [ ] Call `logClientError()` in frontend catch blocks, passing the `user` object from your auth context
- [ ] Build an admin UI tab using the query pattern in Section 7

---

## 9. Key Design Decisions to Preserve

| Decision | Reason |
|---|---|
| Client endpoint has no auth | Errors can occur before a user is logged in |
| Server never returns 500 on logging failure | Logging should never break the user experience |
| 30-second dedup window is in-memory, not Firestore | Keeps write volume low; resets on server restart (acceptable) |
| `undefined` values stripped before Firestore write | Firestore rejects documents with `undefined` — causes silent failures |
| Dual-query for `userUid` (top-level + `context.patientUid`) | Some subsystems store UID in context rather than at top level |
| `wasShownToUser` flag | Lets the admin distinguish errors the patient saw vs. silent backend failures |
