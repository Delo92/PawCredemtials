# Diagnostics Tab Implementation Guide

A complete, copy-paste guide to add a Diagnostics page with **Error Logs** (Firestore-backed) and **GA4 Analytics** (Google Analytics Data API) to any Firebase + Express + React project.

---

## Prerequisites

- Firebase Admin SDK initialized (Firestore + Auth)
- Express.js backend with auth middleware
- React frontend with TanStack Query, shadcn/ui, Tailwind CSS, lucide-react
- `@google-analytics/data` npm package (for GA4 tab)

### NPM Packages Needed

```bash
npm install @google-analytics/data
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GA4_PROPERTY_ID` | Numeric GA4 Property ID | `518327972` |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | `firebase-adminsdk-xxx@project.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key | `-----BEGIN PRIVATE KEY-----\n...` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `my-project-id` |

### Google Cloud Setup (for GA4)

1. Enable the **Google Analytics Data API** in your Google Cloud Console:
   `https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=YOUR_PROJECT_NUMBER`
2. Add your Firebase service account email as a **Viewer** on the GA4 property:
   - Go to analytics.google.com > Admin > Property access management
   - Add the service account email with **Viewer** role

### GA4 Tracking Tag (in index.html)

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'YOUR_MEASUREMENT_ID');
</script>
```

Replace `YOUR_MEASUREMENT_ID` with your GA4 Measurement ID (format: `G-XXXXXXXXXX`).

---

## File Structure

```
server/
  services/
    errorLogger.ts        # Error logging service (Firestore)
    ga4Analytics.ts        # GA4 Data API service
  routes.ts               # API endpoints (add 3 routes)
  firebase-admin.ts       # Must export getCredentials()

client/
  src/
    lib/
      clientErrorLogger.ts  # Frontend error reporter
    pages/
      dashboard/
        owner/
          Diagnostics.tsx   # Full Diagnostics page with tabs
```

---

## 1. Server: Error Logger Service

**File: `server/services/errorLogger.ts`**

This service writes error logs to a Firestore `errorLogs` collection with deduplication, user level inference, and sensitive data redaction.

```typescript
import { firestore } from '../firebase-admin';
import type { Query, CollectionReference, DocumentData } from 'firebase-admin/firestore';

export type ErrorType =
  | 'registration' | 'payment' | 'approval' | 'queue'
  | 'api' | 'client' | 'email' | 'sms' | 'pdf'
  | 'security_alert' | 'workflow' | 'system' | 'database'
  | 'authentication' | 'validation' | 'form_upload'
  | 'admin_operation_error' | 'workflow_error' | 'email_error'
  | 'sms_error' | 'package_not_found' | 'manual_action'
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

// --- Deduplication (30-second window) ---
const recentErrors = new Map<string, number>();

function getErrorKey(errorData: ErrorLogData): string {
  return [errorData.errorType, errorData.message, errorData.userUid || 'anonymous'].join('::');
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

// --- User level inference from context ---
function inferUserLevel(errorData: ErrorLogData): 1 | 2 | 3 | 4 | null {
  if (errorData.userLevel !== undefined && errorData.userLevel !== null) {
    return errorData.userLevel;
  }
  const context = errorData.context || {};
  const message = errorData.message?.toLowerCase() || '';
  if (context.doctorUid || context.doctorFirebaseUid || context.doctorName) return 2;
  if (context.adminUid || context.adminFirebaseUid) return 3;
  if (context.patientUid || context.patientFirebaseUid || context.patientName) return 1;
  if (message.includes('doctor') || message.includes('reviewer')) return 2;
  if (message.includes('admin')) return 3;
  if (message.includes('patient') || message.includes('applicant')) return 1;
  return null;
}

// --- Clean undefined values for Firestore ---
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

// --- Main logging function ---
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

// --- Fetch error logs with filters ---
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
          .orderBy('timestamp', 'desc').limit(queryLimit).get(),
        buildBaseQuery(db.collection('errorLogs'))
          .where('context.patientUid', '==', options.userUid)
          .orderBy('timestamp', 'desc').limit(queryLimit).get()
      ]);
      const logMap = new Map<string, StoredErrorLog>();
      const processDoc = (doc: any) => {
        if (!logMap.has(doc.id)) {
          logMap.set(doc.id, {
            id: doc.id, ...doc.data(),
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
    if (options.startDate) { countQuery = countQuery.where('timestamp', '>=', options.startDate); dataQuery = dataQuery.where('timestamp', '>=', options.startDate); }
    if (options.endDate) { countQuery = countQuery.where('timestamp', '<=', options.endDate); dataQuery = dataQuery.where('timestamp', '<=', options.endDate); }
    if (options.severity) { countQuery = countQuery.where('severity', '==', options.severity); dataQuery = dataQuery.where('severity', '==', options.severity); }
    if (options.errorType) { countQuery = countQuery.where('errorType', '==', options.errorType); dataQuery = dataQuery.where('errorType', '==', options.errorType); }
    if (options.userLevel !== undefined) { countQuery = countQuery.where('userLevel', '==', options.userLevel); dataQuery = dataQuery.where('userLevel', '==', options.userLevel); }
    if (offset > 0) {
      const offsetSnapshot = await dataQuery.limit(offset).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        dataQuery = dataQuery.startAfter(lastDoc);
      }
    }
    dataQuery = dataQuery.limit(queryLimit);
    const [countSnapshot, dataSnapshot] = await Promise.all([countQuery.count().get(), dataQuery.get()]);
    const logs: StoredErrorLog[] = dataSnapshot.docs.map(doc => ({
      id: doc.id, ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
    } as StoredErrorLog));
    return { logs, total: countSnapshot.data().count };
  } catch (err) {
    console.error('ERROR LOGGER: Failed to fetch error logs:', err);
    return { logs: [], total: 0 };
  }
}

// --- Sanitize context data (redact passwords/tokens/secrets) ---
export function createErrorContext(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
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

## 2. Server: GA4 Analytics Service

**File: `server/services/ga4Analytics.ts`**

This service uses the Google Analytics Data API to fetch traffic data. It reuses Firebase service account credentials.

**Important:** Your `firebase-admin.ts` must export a `getCredentials()` function that returns `{ projectId, clientEmail, privateKey }`.

```typescript
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { getCredentials } from "../firebase-admin";

let _client: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient {
  if (_client) return _client;
  const creds = getCredentials();
  _client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: creds.clientEmail,
      private_key: creds.privateKey,
    },
    projectId: creds.projectId,
  });
  return _client;
}

function getPropertyId(): string {
  const id = process.env.GA4_PROPERTY_ID;
  if (!id) throw new Error("GA4_PROPERTY_ID environment variable not set");
  return id;
}

export async function getGA4Report(dateRange: string = "30d") {
  const client = getClient();
  const propertyId = getPropertyId();

  const startDate = dateRange === "7d" ? "7daysAgo"
    : dateRange === "90d" ? "90daysAgo"
    : dateRange === "1y" ? "365daysAgo"
    : "30daysAgo";

  try {
    const [overviewResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate: "today" }],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
        { name: "newUsers" },
      ],
    });

    const overviewRow = overviewResponse.rows?.[0];
    const overview = {
      activeUsers: parseInt(overviewRow?.metricValues?.[0]?.value || "0"),
      sessions: parseInt(overviewRow?.metricValues?.[1]?.value || "0"),
      pageViews: parseInt(overviewRow?.metricValues?.[2]?.value || "0"),
      avgSessionDuration: parseFloat(overviewRow?.metricValues?.[3]?.value || "0"),
      bounceRate: parseFloat(overviewRow?.metricValues?.[4]?.value || "0"),
      newUsers: parseInt(overviewRow?.metricValues?.[5]?.value || "0"),
    };

    const [pageResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    });

    const topPages = (pageResponse.rows || []).map(row => ({
      path: row.dimensionValues?.[0]?.value || "",
      views: parseInt(row.metricValues?.[0]?.value || "0"),
      users: parseInt(row.metricValues?.[1]?.value || "0"),
    }));

    const [dailyResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
    });

    const dailyData = (dailyResponse.rows || []).map(row => {
      const raw = row.dimensionValues?.[0]?.value || "";
      const formatted = raw.length === 8
        ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
        : raw;
      return {
        date: formatted,
        users: parseInt(row.metricValues?.[0]?.value || "0"),
        sessions: parseInt(row.metricValues?.[1]?.value || "0"),
        pageViews: parseInt(row.metricValues?.[2]?.value || "0"),
      };
    });

    const [sourceResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    });

    const trafficSources = (sourceResponse.rows || []).map(row => ({
      source: row.dimensionValues?.[0]?.value || "(direct)",
      sessions: parseInt(row.metricValues?.[0]?.value || "0"),
    }));

    return { overview, topPages, dailyData, trafficSources };
  } catch (error: any) {
    console.error("GA4 API error:", error.message);
    throw error;
  }
}
```

---

## 3. Server: API Routes

Add these 3 routes to your Express router. Adjust `requireAuth` and `requireLevel()` to match your auth middleware.

```typescript
import { logError, getErrorLogs, createErrorContext } from "./services/errorLogger";
import { getGA4Report } from "./services/ga4Analytics";

// --- Route 1: Client-side error logging (public, optional auth) ---
app.post("/api/error/log-client-error", async (req, res) => {
  try {
    const {
      errorType, severity, message,
      userUid, userName, userEmail, userLevel,
      endpoint, context, stackTrace
    } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    let verifiedUid: string | undefined;
    let verifiedEmail: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await getAdminAuth().verifyIdToken(authHeader.split(" ")[1]);
        verifiedUid = decoded.uid;
        verifiedEmail = decoded.email;
      } catch {}
    }

    await logError({
      errorType: errorType || 'client',
      severity: severity || 'error',
      message,
      stackTrace,
      userUid: verifiedUid || userUid || undefined,
      userName: userName || undefined,
      userEmail: verifiedEmail || userEmail || undefined,
      userLevel: userLevel || undefined,
      endpoint: endpoint || 'client-side',
      method: 'CLIENT',
      wasShownToUser: true,
      context: {
        ...context,
        source: 'client_error',
        identityVerified: !!verifiedUid,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      }
    });

    res.json({ success: true, message: 'Error logged successfully' });
  } catch (error) {
    console.error('Failed to log client error:', error);
    res.json({ success: false, message: 'Failed to log error' });
  }
});

// --- Route 2: Fetch error logs (admin only) ---
app.get("/api/admin/error-logs", requireAuth, requireLevel(4), async (req, res) => {
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
    console.error('Error fetching error logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch error logs' });
  }
});

// --- Route 3: GA4 analytics data (admin only) ---
app.get("/api/admin/ga4-analytics", requireAuth, requireLevel(4), async (req, res) => {
  try {
    const dateRange = (req.query.dateRange as string) || "30d";
    const data = await getGA4Report(dateRange);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("GA4 analytics error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch analytics data" });
  }
});
```

---

## 4. Client: Error Logger Helper

**File: `client/src/lib/clientErrorLogger.ts`**

Call `logClientError()` from anywhere in the frontend to report errors to the server.

```typescript
import { auth } from './firebase';

export type ClientErrorType =
  | 'websocket' | 'network' | 'api' | 'client'
  | 'form_upload' | 'uncategorized';

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
  user?: { uid?: string; firstName?: string; lastName?: string; email?: string; }
): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    const userName = user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}` : undefined;
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
        stackTrace, userUid, userName, userEmail,
        endpoint: window.location.pathname,
        context,
        wasShownToUser: errorData.wasShownToUser ?? true
      })
    });
  } catch (error) {
    console.error('CLIENT ERROR LOGGER: Failed to log client error:', error);
  }
}
```

### Usage Examples

```typescript
import { logClientError } from '@/lib/clientErrorLogger';

// Log a caught error
try {
  await riskyOperation();
} catch (err) {
  logClientError({
    errorType: 'api',
    severity: 'error',
    message: 'Failed to submit form',
    error: err,
    wasShownToUser: true
  });
}

// Log a warning
logClientError({
  errorType: 'client',
  severity: 'warning',
  message: 'User tried to access restricted page',
  context: { attemptedRoute: '/admin' }
});
```

---

## 5. Client: Diagnostics Page (Full Component)

**File: `client/src/pages/dashboard/owner/Diagnostics.tsx`**

This is the complete page component with two tabs: Analytics and Error Logs.

**Adapt these imports to match your project:**
- `auth` from your Firebase client config
- `useAuth` from your auth context
- `DashboardLayout` from your layout component
- shadcn/ui components (Card, Button, Badge, Input, Select, Skeleton)

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";       // YOUR Firebase client auth
import { useAuth } from "@/contexts/AuthContext"; // YOUR auth context
import { DashboardLayout } from "@/components/dashboard/DashboardLayout"; // YOUR layout
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, AlertCircle, Info, ShieldAlert,
  ChevronDown, ChevronRight, RefreshCw, Search,
  BarChart3, TrendingUp, Users, Eye, Clock,
  ArrowUpRight, Globe, FileText, Loader2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────

interface ErrorLog {
  id: string;
  errorType: string;
  severity: string;
  message: string;
  stackTrace?: string;
  userLevel?: number;
  userUid?: string;
  userName?: string;
  userEmail?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  context?: Record<string, any>;
  wasShownToUser?: boolean;
  timestamp: string;
  createdAt: string;
}

interface GA4Data {
  overview: {
    activeUsers: number;
    sessions: number;
    pageViews: number;
    avgSessionDuration: number;
    bounceRate: number;
    newUsers: number;
  };
  topPages: Array<{ path: string; views: number; users: number }>;
  dailyData: Array<{ date: string; users: number; sessions: number; pageViews: number }>;
  trafficSources: Array<{ source: string; sessions: number }>;
}

// ─── Constants ───────────────────────────────────────────

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  error: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  info: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
};

const severityIcons: Record<string, any> = {
  critical: ShieldAlert, error: AlertCircle, warning: AlertTriangle, info: Info,
};

const errorTypeLabels: Record<string, string> = {
  registration: "Registration", payment: "Payment", approval: "Approval",
  queue: "Queue", api: "API", client: "Client", email: "Email",
  sms: "SMS", pdf: "PDF", security_alert: "Security", workflow: "Workflow",
  system: "System", database: "Database", authentication: "Auth",
  validation: "Validation", form_upload: "Form Upload",
  admin_operation_error: "Admin Op", workflow_error: "Workflow",
  email_error: "Email", sms_error: "SMS", package_not_found: "Package",
  manual_action: "Manual", uncategorized: "Other",
};

// ─── Helpers ─────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function MiniBarChart({ data, dataKey, maxHeight = 120 }: {
  data: Array<Record<string, any>>; dataKey: string; maxHeight?: number
}) {
  if (!data.length) return null;
  const values = data.map(d => d[dataKey] as number);
  const max = Math.max(...values, 1);
  const barWidth = Math.max(4, Math.min(20, Math.floor(300 / data.length) - 2));
  return (
    <div className="flex items-end gap-[2px] justify-center" style={{ height: maxHeight }}>
      {data.map((d, i) => {
        const height = Math.max(2, (d[dataKey] / max) * (maxHeight - 20));
        return (
          <div key={i} className="flex flex-col items-center group relative">
            <div
              className="bg-primary/80 hover:bg-primary rounded-t transition-colors cursor-default"
              style={{ width: barWidth, height }}
              title={`${d.date}: ${d[dataKey]}`}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Analytics Tab ───────────────────────────────────────

function AnalyticsTab() {
  const [dateRange, setDateRange] = useState("30d");

  const { data: ga4Data, isLoading, error } = useQuery<GA4Data>({
    queryKey: ["/api/admin/ga4-analytics", dateRange],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/ga4-analytics?dateRange=${dateRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const json = await res.json();
      return json.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading analytics data...</p>
        </CardContent></Card>
      )}

      {error && (
        <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mb-4" />
          <p className="text-sm text-destructive mb-2">Failed to load GA4 data</p>
          <p className="text-xs text-muted-foreground max-w-md">
            Make sure the Firebase service account has Viewer access on the GA4 property and data collection is active.
          </p>
        </CardContent></Card>
      )}

      {ga4Data && (
        <>
          {/* Overview metric cards */}
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Active Users", value: ga4Data.overview.activeUsers, icon: Users, sub: `${ga4Data.overview.newUsers} new`, subColor: "text-green-600" },
              { label: "Sessions", value: ga4Data.overview.sessions, icon: Globe, sub: "Total visits" },
              { label: "Page Views", value: ga4Data.overview.pageViews, icon: Eye, sub: "Total views" },
              { label: "Avg Duration", value: formatDuration(ga4Data.overview.avgSessionDuration), icon: Clock, sub: "Per session", raw: true },
              { label: "Bounce Rate", value: formatPercent(ga4Data.overview.bounceRate), icon: TrendingUp, sub: "Single page visits", raw: true },
              { label: "New Users", value: ga4Data.overview.newUsers, icon: ArrowUpRight, sub: "First-time visitors" },
            ].map(({ label, value, icon: Icon, sub, subColor, raw }) => (
              <Card key={label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{raw ? value : (value as number).toLocaleString()}</div>
                  <div className={`text-xs ${subColor || "text-muted-foreground"}`}>
                    {subColor && <ArrowUpRight className="h-3 w-3 mr-1 inline" />}{sub}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Daily charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle>Daily Users</CardTitle><CardDescription>Active users per day</CardDescription></CardHeader>
              <CardContent>{ga4Data.dailyData.length > 0
                ? <MiniBarChart data={ga4Data.dailyData} dataKey="users" />
                : <div className="flex flex-col items-center justify-center h-[120px] text-center"><BarChart3 className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No data yet</p></div>
              }</CardContent></Card>
            <Card><CardHeader><CardTitle>Daily Page Views</CardTitle><CardDescription>Page views per day</CardDescription></CardHeader>
              <CardContent>{ga4Data.dailyData.length > 0
                ? <MiniBarChart data={ga4Data.dailyData} dataKey="pageViews" />
                : <div className="flex flex-col items-center justify-center h-[120px] text-center"><Eye className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No data yet</p></div>
              }</CardContent></Card>
          </div>

          {/* Top Pages + Traffic Sources */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle>Top Pages</CardTitle><CardDescription>Most visited pages</CardDescription></CardHeader>
              <CardContent>{ga4Data.topPages.length > 0 ? (
                <div className="space-y-3">{ga4Data.topPages.map((page, i) => {
                  const widthPercent = (page.views / (ga4Data.topPages[0]?.views || 1)) * 100;
                  return (<div key={i} className="space-y-1"><div className="flex items-center justify-between text-sm"><span className="truncate max-w-[200px] font-medium">{page.path}</span><span className="text-muted-foreground ml-2">{page.views} views</span></div><div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${widthPercent}%` }} /></div></div>);
                })}</div>
              ) : (<div className="flex flex-col items-center justify-center h-[200px] text-center"><FileText className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No page data yet</p></div>)}</CardContent></Card>

            <Card><CardHeader><CardTitle>Traffic Sources</CardTitle><CardDescription>Where visitors come from</CardDescription></CardHeader>
              <CardContent>{ga4Data.trafficSources.length > 0 ? (
                <div className="space-y-3">{ga4Data.trafficSources.map((source, i) => {
                  const widthPercent = (source.sessions / (ga4Data.trafficSources[0]?.sessions || 1)) * 100;
                  return (<div key={i} className="space-y-1"><div className="flex items-center justify-between text-sm"><span className="font-medium">{source.source || "(direct)"}</span><span className="text-muted-foreground ml-2">{source.sessions} sessions</span></div><div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${widthPercent}%` }} /></div></div>);
                })}</div>
              ) : (<div className="flex flex-col items-center justify-center h-[200px] text-center"><Globe className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No source data yet</p></div>)}</CardContent></Card>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Error Logs Tab ──────────────────────────────────────

function ErrorLogsTab() {
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filters, setFilters] = useState({ severity: "all", errorType: "all", search: "" });

  const { data, isLoading, refetch, isFetching } = useQuery<{ logs: ErrorLog[]; total: number }>({
    queryKey: ["/api/admin/error-logs", filters, page],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const params = new URLSearchParams();
      if (filters.severity !== "all") params.set("severity", filters.severity);
      if (filters.errorType !== "all") params.set("errorType", filters.errorType);
      params.set("limit", "50");
      params.set("offset", String(page * 50));
      const res = await fetch(`/api/admin/error-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch error logs");
      return res.json();
    },
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 50);
  const filteredLogs = filters.search
    ? logs.filter(log =>
        log.message.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.userName?.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.userEmail?.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.endpoint?.toLowerCase().includes(filters.search.toLowerCase())
      )
    : logs;

  const stats = {
    critical: logs.filter(l => l.severity === "critical").length,
    error: logs.filter(l => l.severity === "error").length,
    warning: logs.filter(l => l.severity === "warning").length,
    info: logs.filter(l => l.severity === "info").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Severity stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["critical", "error", "warning", "info"] as const).map(sev => {
          const Icon = severityIcons[sev];
          return (
            <Card key={sev}><CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${sev === "critical" ? "text-red-500" : sev === "error" ? "text-orange-500" : sev === "warning" ? "text-yellow-500" : "text-blue-500"}`} />
              <div><p className="text-2xl font-bold">{stats[sev]}</p><p className="text-xs text-muted-foreground capitalize">{sev}</p></div>
            </CardContent></Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search messages, users, endpoints..." value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} className="pl-9" />
        </div>
        <Select value={filters.severity} onValueChange={v => { setFilters(f => ({ ...f, severity: v })); setPage(0); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.errorType} onValueChange={v => { setFilters(f => ({ ...f, errorType: v })); setPage(0); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Error Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(errorTypeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error log list */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filteredLogs.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No error logs found</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map(log => {
            const isExpanded = expandedRow === log.id;
            const Icon = severityIcons[log.severity] || AlertCircle;
            const colorClass = severityColors[log.severity] || severityColors.info;
            return (
              <Card key={log.id}>
                <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedRow(isExpanded ? null : log.id)}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</div>
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={colorClass}>{log.severity}</Badge>
                        <Badge variant="secondary">{errorTypeLabels[log.errorType] || log.errorType}</Badge>
                        {log.wasShownToUser && <Badge variant="outline" className="text-xs">Shown to user</Badge>}
                      </div>
                      <p className="text-sm font-medium truncate">{log.message}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                        {log.userName && <span>{log.userName}</span>}
                        {log.endpoint && <span>{log.endpoint}</span>}
                      </div>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t pt-3 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {log.userUid && <div><span className="text-muted-foreground">User ID:</span><p className="font-mono text-xs break-all">{log.userUid}</p></div>}
                      {log.userEmail && <div><span className="text-muted-foreground">Email:</span><p>{log.userEmail}</p></div>}
                      {log.method && <div><span className="text-muted-foreground">Method:</span><p>{log.method}</p></div>}
                      {log.statusCode && <div><span className="text-muted-foreground">Status:</span><p>{log.statusCode}</p></div>}
                    </div>
                    {log.stackTrace && (<div><p className="text-xs text-muted-foreground mb-1">Stack Trace:</p><pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48 whitespace-pre-wrap">{log.stackTrace}</pre></div>)}
                    {log.context && Object.keys(log.context).length > 0 && (<div><p className="text-xs text-muted-foreground mb-1">Context:</p><pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48 whitespace-pre-wrap">{JSON.stringify(log.context, null, 2)}</pre></div>)}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page + 1} of {totalPages} ({total} total)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Diagnostics Page ───────────────────────────────

export default function Diagnostics() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"analytics" | "errors">("analytics");

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Diagnostics</h1>
          <p className="text-muted-foreground">Site traffic analytics and error monitoring</p>
        </div>

        <div className="flex gap-1 border-b">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "analytics" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("analytics")}
          >
            <BarChart3 className="h-4 w-4 inline-block mr-2" />Analytics
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "errors" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("errors")}
          >
            <AlertTriangle className="h-4 w-4 inline-block mr-2" />Error Logs
          </button>
        </div>

        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "errors" && <ErrorLogsTab />}
      </div>
    </DashboardLayout>
  );
}
```

---

## 6. Routing and Navigation

### Add Route (App.tsx or router config)

```tsx
const Diagnostics = lazy(() => import("@/pages/dashboard/owner/Diagnostics"));

<Route path="/dashboard/owner/diagnostics">
  <ProtectedRoute minLevel={4}>
    <Diagnostics />
  </ProtectedRoute>
</Route>
```

### Add Sidebar Item (navigation config)

```typescript
{ title: "Diagnostics", href: "/dashboard/owner/diagnostics", icon: AlertTriangle }
```

---

## 7. Server-Side Error Logging Usage

Call `logError()` from any server route or service:

```typescript
import { logError, createErrorContext } from "./services/errorLogger";

// In a catch block
try {
  await someOperation();
} catch (error: any) {
  await logError({
    errorType: 'payment',
    severity: 'error',
    message: `Payment failed: ${error.message}`,
    stackTrace: error.stack,
    userUid: req.user?.firebaseUid,
    userName: `${req.user?.firstName} ${req.user?.lastName}`,
    userEmail: req.user?.email,
    endpoint: req.originalUrl,
    method: req.method,
    statusCode: 500,
    context: createErrorContext({
      orderId: order.id,
      amount: order.amount,
      rawError: error.message
    }),
    wasShownToUser: true
  });
  res.status(500).json({ message: "Payment failed" });
}
```

---

## 8. Firebase Admin Credential Export

Your `firebase-admin.ts` must export `getCredentials()`. Add this if it doesn't exist:

```typescript
export function getCredentials(): { projectId: string; clientEmail: string; privateKey: string } {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase credentials not found. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.");
  }

  return { projectId, clientEmail, privateKey };
}
```

---

## Checklist for New Project

- [ ] Install `@google-analytics/data` npm package
- [ ] Set `GA4_PROPERTY_ID` environment variable
- [ ] Set Firebase credentials (env vars or service account JSON)
- [ ] Enable Google Analytics Data API in Google Cloud Console
- [ ] Add Firebase service account as Viewer on GA4 property
- [ ] Add GA4 tracking tag to `index.html`
- [ ] Create `server/services/errorLogger.ts`
- [ ] Create `server/services/ga4Analytics.ts`
- [ ] Export `getCredentials()` from `firebase-admin.ts`
- [ ] Add 3 API routes to `routes.ts`
- [ ] Create `client/src/lib/clientErrorLogger.ts`
- [ ] Create `client/src/pages/dashboard/owner/Diagnostics.tsx`
- [ ] Add route and sidebar navigation entry
- [ ] Sprinkle `logError()` calls in server catch blocks
- [ ] Sprinkle `logClientError()` calls in frontend error handlers
