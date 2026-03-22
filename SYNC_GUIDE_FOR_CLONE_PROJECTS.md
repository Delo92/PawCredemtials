# Complete Sync Guide — Bringing Clone Projects Up to Spec

## Understanding the Timeline

**Your logic is correct.** This project has 16 days of history. The other project stopped regular development 20 days ago. Therefore everything in this project is newer than the other project's last update.

**One counterpoint to be aware of:** The other project's agent has been working in the last hour and added *basic* versions of GA4 tracking, error logging, and referral URL capture. Those are incomplete — they need to be replaced with the full implementations in this guide. Everything else is untouched.

---

## Required Package Installation

Before anything else, install this package:

```
@google-analytics/data
```

(The GA4 Data API service requires it. The tracking tag in index.html does NOT require it — this is the server-side real-data API.)

---

## Step 1 — Create `server/services/errorLogger.ts`

This is the full server-side error logging service. Replace or create this file entirely:

```typescript
import { firestore } from '../firebase-admin';
import type { Query, CollectionReference, DocumentData } from 'firebase-admin/firestore';

export type ErrorType = 
  | 'registration' | 'payment' | 'approval' | 'queue' | 'api' | 'client'
  | 'email' | 'sms' | 'pdf' | 'security_alert' | 'workflow' | 'system'
  | 'database' | 'authentication' | 'validation' | 'form_upload'
  | 'admin_operation_error' | 'workflow_error' | 'email_error' | 'sms_error'
  | 'package_not_found' | 'manual_action' | 'uncategorized';

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

function inferUserLevel(errorData: ErrorLogData): 1 | 2 | 3 | 4 | null {
  if (errorData.userLevel !== undefined && errorData.userLevel !== null) return errorData.userLevel;
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
  startDate?: Date; endDate?: Date; severity?: ErrorSeverity; errorType?: ErrorType;
  userLevel?: number; userUid?: string; limit?: number; offset?: number;
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
        buildBaseQuery(db.collection('errorLogs')).where('userUid', '==', options.userUid)
          .orderBy('timestamp', 'desc').limit(queryLimit).get(),
        buildBaseQuery(db.collection('errorLogs')).where('context.patientUid', '==', options.userUid)
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

## Step 2 — Create `client/src/lib/clientErrorLogger.ts`

```typescript
import { auth } from './firebase';

export type ClientErrorType = 'websocket' | 'network' | 'api' | 'client' | 'form_upload' | 'uncategorized';
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
    const userName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : undefined;
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
```

---

## Step 3 — Create `server/services/ga4Analytics.ts`

```typescript
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { getCredentials } from "../firebase-admin";

let _client: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient {
  if (_client) return _client;
  const creds = getCredentials();
  _client = new BetaAnalyticsDataClient({
    credentials: { client_email: creds.clientEmail, private_key: creds.privateKey },
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
        { name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" },
        { name: "averageSessionDuration" }, { name: "bounceRate" }, { name: "newUsers" },
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
      const formatted = raw.length === 8 ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}` : raw;
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

**Required environment variable:** `GA4_PROPERTY_ID` — this is the **numeric** property ID from GA4 (not the G-XXXXXXXX Measurement ID). Find it in GA4 → Admin → Property Settings.

**Required GA4 access:** Add the Firebase service account email as a Viewer on the GA4 property. Enable "Google Analytics Data API" in Google Cloud Console for your project.

---

## Step 4 — Create `server/services/chronicBrands.ts`

```typescript
interface PromoRedemptionData {
  code: string;
  orderNumber: string;
  orderValue: string;
  discountAmount?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
}

export async function trackPromoRedemption(data: PromoRedemptionData): Promise<void> {
  const apiKey = process.env.PROMO_API_KEY || process.env.CHRONIC_BRANDS_API_KEY;
  if (!apiKey) {
    console.warn("CHRONIC_BRANDS: API key not configured — skipping promo redemption tracking");
    return;
  }
  try {
    const response = await fetch("https://chronicbrandsusa.com/api/webhooks/promo-redemption", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        code: data.code,
        brandName: "YOUR BRAND NAME HERE",    // ← update for this project
        platform: "YOUR PLATFORM NAME HERE",  // ← update for this project
        orderNumber: data.orderNumber,
        orderValue: data.orderValue,
        discountAmount: data.discountAmount || "0.00",
        customerName: data.customerName || null,
        customerEmail: data.customerEmail || null,
        customerPhone: data.customerPhone || null,
        notes: data.notes || `Order completed at ${new Date().toISOString()}`,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.valid) {
      console.warn(`CHRONIC_BRANDS: Redemption tracking failed for code "${data.code}":`, result.message || response.status);
    } else {
      console.log(`CHRONIC_BRANDS: Redemption tracked for code "${data.code}", redemption ID: ${result.redemption?.id}`);
    }
  } catch (err: any) {
    console.error("CHRONIC_BRANDS: Failed to reach webhook:", err.message);
  }
}
```

**Required environment variable:** `PROMO_API_KEY`

---

## Step 5 — Add Three Routes to `server/routes.ts`

Add these three route blocks together. Import at the top of routes.ts first:

```typescript
import { logError, getErrorLogs } from "./services/errorLogger";
import { getGA4Report } from "./services/ga4Analytics";
import { trackPromoRedemption } from "./services/chronicBrands";
```

Then add these route blocks (find a good place, e.g. before the admin settings section):

```typescript
// ─── ERROR LOGGING ROUTES ───────────────────────────────────────────────────

app.post("/api/error/log-client-error", async (req, res) => {
  try {
    const { errorType, severity, message, userUid, userName, userEmail, userLevel, endpoint, context, stackTrace } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

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
      context: { ...context, source: 'client_error', identityVerified: !!verifiedUid, userAgent: req.headers['user-agent'], timestamp: new Date().toISOString() }
    });

    res.json({ success: true, message: 'Error logged successfully' });
  } catch (error) {
    console.error('Failed to log client error:', error);
    res.json({ success: false, message: 'Failed to log error' });
  }
});

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
      if (!userName && context.firstName && context.lastName) userName = `${context.firstName} ${context.lastName}`;
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

## Step 6 — Wire Promo Code Through Payment Routes

In `server/routes.ts`, find `app.post("/api/payment/charge", ...)` and update the destructure line:

```typescript
// BEFORE:
const { opaqueDataDescriptor, opaqueDataValue, packageId, formData } = req.body;

// AFTER:
const { opaqueDataDescriptor, opaqueDataValue, packageId, formData, promoCode } = req.body;
```

Then after the workflow steps loop (after `storage.createApplicationStep` calls), add:

```typescript
if (promoCode) {
  trackPromoRedemption({
    code: promoCode,
    orderNumber: application.id,
    orderValue: (Number(pkg.price) / 100).toFixed(2),
    discountAmount: "0.00",
    customerName: patientName,
    customerEmail: patient.email,
    notes: `Application - ${pkg.name}`,
  }).catch((err) => console.error("CHRONIC_BRANDS: tracking error:", err.message));
}
```

Find `app.post("/api/applications", ...)` and similarly update the destructure:

```typescript
// BEFORE:
const { packageId, formData, paymentStatus: reqPaymentStatus, autoSendToDoctor } = req.body;

// AFTER:
const { packageId, formData, paymentStatus: reqPaymentStatus, autoSendToDoctor, promoCode } = req.body;
```

Then after workflow steps, add the same webhook call:

```typescript
if (promoCode && effectivePaymentStatus === "paid") {
  const patient = req.user!;
  trackPromoRedemption({
    code: promoCode,
    orderNumber: application.id,
    orderValue: (Number(pkg.price) / 100).toFixed(2),
    discountAmount: "0.00",
    customerName: `${patient.firstName} ${patient.lastName}`,
    customerEmail: patient.email,
    notes: `Application - ${pkg.name}`,
  }).catch((err) => console.error("CHRONIC_BRANDS: tracking error:", err.message));
}
```

---

## Step 7 — Create `client/src/pages/PromoRedirect.tsx`

```typescript
import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2 } from "lucide-react";

export default function PromoRedirect() {
  const params = useParams<{ promoCode: string }>();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const code = params.promoCode;
    if (code && /^[a-zA-Z0-9_-]{2,30}$/.test(code)) {
      localStorage.setItem("promoCode", code.toUpperCase());
      console.log(`Promo/referral code captured: ${code.toUpperCase()}`);
    }
    setLocation("/");
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
```

Then in `client/src/App.tsx`, add the import and route. The route must go **last** before the NotFound fallback:

```typescript
// Add import with other lazy imports:
const PromoRedirect = lazy(() => import("@/pages/PromoRedirect"));

// Add route LAST before NotFound:
<Route path="/:promoCode">
  <AppShell><PromoRedirect /></AppShell>
</Route>
```

---

## Step 8 — Toast Auto Error Logging

In `client/src/hooks/use-toast.ts`, add this import at the very top:

```typescript
import { logClientError } from "@/lib/clientErrorLogger"
```

Then find `function toast({ ...props }: Toast) {` and add this block immediately after the `const id = genId()` line:

```typescript
if (props.variant === "destructive") {
  const title = typeof props.title === "string" ? props.title : "Error";
  const description = typeof props.description === "string" ? props.description : undefined;
  const message = description ? `${title}: ${description}` : title;
  logClientError({
    errorType: "client",
    severity: "error",
    message,
    wasShownToUser: true,
    context: { toastTitle: title, toastDescription: description },
  }).catch(() => {});
}
```

This single change auto-logs every red error toast across the entire app without touching any individual component.

---

## Step 9 — Replace Diagnostics Page

The other project has separate Analytics and Diagnostics pages. Replace the Diagnostics page (`client/src/pages/dashboard/owner/Diagnostics.tsx`) with the full merged version that has both Analytics and Error Logs as tabs. Delete the standalone Analytics page if one exists and remove it from the sidebar.

Full file content for `client/src/pages/dashboard/owner/Diagnostics.tsx`:

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, AlertCircle, Info, ShieldAlert,
  ChevronDown, ChevronRight, RefreshCw, Search,
  BarChart3, TrendingUp, Users, Eye, Clock, ArrowUpRight,
  Globe, FileText, Loader2,
} from "lucide-react";

interface ErrorLog {
  id: string; errorType: string; severity: string; message: string;
  stackTrace?: string; userLevel?: number; userUid?: string; userName?: string;
  userEmail?: string; endpoint?: string; method?: string; statusCode?: number;
  context?: Record<string, any>; wasShownToUser?: boolean; timestamp: string; createdAt: string;
}

interface GA4Data {
  overview: { activeUsers: number; sessions: number; pageViews: number; avgSessionDuration: number; bounceRate: number; newUsers: number; };
  topPages: Array<{ path: string; views: number; users: number }>;
  dailyData: Array<{ date: string; users: number; sessions: number; pageViews: number }>;
  trafficSources: Array<{ source: string; sessions: number }>;
}

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
  registration: "Registration", payment: "Payment", approval: "Approval", queue: "Queue",
  api: "API", client: "Client", email: "Email", sms: "SMS", pdf: "PDF",
  security_alert: "Security", workflow: "Workflow", system: "System", database: "Database",
  authentication: "Auth", validation: "Validation", form_upload: "Form Upload",
  admin_operation_error: "Admin Op", workflow_error: "Workflow", email_error: "Email",
  sms_error: "SMS", package_not_found: "Package", manual_action: "Manual", uncategorized: "Other",
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function MiniBarChart({ data, dataKey, maxHeight = 120 }: { data: Array<Record<string, any>>; dataKey: string; maxHeight?: number }) {
  if (!data.length) return null;
  const values = data.map(d => d[dataKey] as number);
  const max = Math.max(...values, 1);
  const barWidth = Math.max(4, Math.min(20, Math.floor(300 / data.length) - 2));
  return (
    <div className="flex items-end gap-[2px] justify-center" style={{ height: maxHeight }} data-testid="chart-mini-bar">
      {data.map((d, i) => {
        const height = Math.max(2, (d[dataKey] / max) * (maxHeight - 20));
        return (
          <div key={i} className="flex flex-col items-center group relative">
            <div className="bg-primary/80 hover:bg-primary rounded-t transition-colors cursor-default"
              style={{ width: barWidth, height }} title={`${d.date}: ${d[dataKey]}`} />
          </div>
        );
      })}
    </div>
  );
}

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
          <SelectTrigger className="w-[180px]" data-testid="select-date-range">
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
          <p className="text-xs text-muted-foreground max-w-md">Make sure the Firebase service account has Viewer access on the GA4 property and data collection is active.</p>
        </CardContent></Card>
      )}
      {ga4Data && (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Active Users", icon: Users, value: ga4Data.overview.activeUsers.toLocaleString(), sub: `${ga4Data.overview.newUsers} new`, testid: "card-active-users" },
              { label: "Sessions", icon: Globe, value: ga4Data.overview.sessions.toLocaleString(), sub: "Total visits", testid: "card-sessions" },
              { label: "Page Views", icon: Eye, value: ga4Data.overview.pageViews.toLocaleString(), sub: "Total views", testid: "card-page-views" },
              { label: "Avg Duration", icon: Clock, value: formatDuration(ga4Data.overview.avgSessionDuration), sub: "Per session", testid: "card-avg-duration" },
              { label: "Bounce Rate", icon: TrendingUp, value: formatPercent(ga4Data.overview.bounceRate), sub: "Single page visits", testid: "card-bounce-rate" },
              { label: "New Users", icon: ArrowUpRight, value: ga4Data.overview.newUsers.toLocaleString(), sub: "First-time visitors", testid: "card-new-users" },
            ].map(({ label, icon: Icon, value, sub, testid }) => (
              <Card key={testid} data-testid={testid}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-daily-users-chart">
              <CardHeader><CardTitle>Daily Users</CardTitle><CardDescription>Active users per day</CardDescription></CardHeader>
              <CardContent>{ga4Data.dailyData.length > 0 ? <MiniBarChart data={ga4Data.dailyData} dataKey="users" /> : <div className="flex flex-col items-center justify-center h-[120px]"><BarChart3 className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No data yet</p></div>}</CardContent>
            </Card>
            <Card data-testid="card-daily-pageviews-chart">
              <CardHeader><CardTitle>Daily Page Views</CardTitle><CardDescription>Page views per day</CardDescription></CardHeader>
              <CardContent>{ga4Data.dailyData.length > 0 ? <MiniBarChart data={ga4Data.dailyData} dataKey="pageViews" /> : <div className="flex flex-col items-center justify-center h-[120px]"><Eye className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No data yet</p></div>}</CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-top-pages">
              <CardHeader><CardTitle>Top Pages</CardTitle><CardDescription>Most visited pages</CardDescription></CardHeader>
              <CardContent>
                {ga4Data.topPages.length > 0 ? (
                  <div className="space-y-3">{ga4Data.topPages.map((page, i) => {
                    const widthPercent = (page.views / (ga4Data.topPages[0]?.views || 1)) * 100;
                    return (
                      <div key={i} className="space-y-1" data-testid={`row-page-${i}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate max-w-[200px] font-medium">{page.path}</span>
                          <span className="text-muted-foreground ml-2">{page.views} views</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${widthPercent}%` }} />
                        </div>
                      </div>
                    );
                  })}</div>
                ) : <div className="flex flex-col items-center justify-center h-[200px]"><FileText className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No page data yet</p></div>}
              </CardContent>
            </Card>
            <Card data-testid="card-traffic-sources">
              <CardHeader><CardTitle>Traffic Sources</CardTitle><CardDescription>Where visitors come from</CardDescription></CardHeader>
              <CardContent>
                {ga4Data.trafficSources.length > 0 ? (
                  <div className="space-y-3">{ga4Data.trafficSources.map((source, i) => {
                    const widthPercent = (source.sessions / (ga4Data.trafficSources[0]?.sessions || 1)) * 100;
                    return (
                      <div key={i} className="space-y-1" data-testid={`row-source-${i}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{source.source || "(direct)"}</span>
                          <span className="text-muted-foreground ml-2">{source.sessions} sessions</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${widthPercent}%` }} />
                        </div>
                      </div>
                    );
                  })}</div>
                ) : <div className="flex flex-col items-center justify-center h-[200px]"><Globe className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No source data yet</p></div>}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

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
      const res = await fetch(`/api/admin/error-logs?${params}`, { headers: { Authorization: `Bearer ${token}` } });
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
        log.endpoint?.toLowerCase().includes(filters.search.toLowerCase()))
    : logs;
  const stats = { critical: logs.filter(l => l.severity === "critical").length, error: logs.filter(l => l.severity === "error").length, warning: logs.filter(l => l.severity === "warning").length, info: logs.filter(l => l.severity === "info").length };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-logs">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["critical", "error", "warning", "info"] as const).map(sev => {
          const Icon = severityIcons[sev];
          return (
            <Card key={sev} data-testid={`card-stat-${sev}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`h-5 w-5 ${sev === "critical" ? "text-red-500" : sev === "error" ? "text-orange-500" : sev === "warning" ? "text-yellow-500" : "text-blue-500"}`} />
                <div><p className="text-2xl font-bold">{stats[sev]}</p><p className="text-xs text-muted-foreground capitalize">{sev}</p></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search messages, users, endpoints..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} className="pl-9" data-testid="input-search-logs" />
        </div>
        <Select value={filters.severity} onValueChange={v => { setFilters(f => ({ ...f, severity: v })); setPage(0); }}>
          <SelectTrigger className="w-[150px]" data-testid="select-severity-filter"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.errorType} onValueChange={v => { setFilters(f => ({ ...f, errorType: v })); setPage(0); }}>
          <SelectTrigger className="w-[150px]" data-testid="select-type-filter"><SelectValue placeholder="Error Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(errorTypeLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
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
              <Card key={log.id} data-testid={`card-error-log-${log.id}`}>
                <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setExpandedRow(isExpanded ? null : log.id)} data-testid={`button-expand-log-${log.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</div>
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={colorClass} data-testid={`badge-severity-${log.id}`}>{log.severity}</Badge>
                        <Badge variant="secondary" data-testid={`badge-type-${log.id}`}>{errorTypeLabels[log.errorType] || log.errorType}</Badge>
                        {log.wasShownToUser && <Badge variant="outline" className="text-xs">Shown to user</Badge>}
                      </div>
                      <p className="text-sm font-medium truncate" data-testid={`text-message-${log.id}`}>{log.message}</p>
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
                    {log.stackTrace && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Stack Trace:</p>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48 whitespace-pre-wrap" data-testid={`text-stack-${log.id}`}>{log.stackTrace}</pre>
                      </div>
                    )}
                    {log.context && Object.keys(log.context).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Context:</p>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48 whitespace-pre-wrap" data-testid={`text-context-${log.id}`}>{JSON.stringify(log.context, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page + 1} of {totalPages} ({total} total)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Diagnostics() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"analytics" | "errors">("analytics");
  if (!user) return null;
  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="diagnostics-page">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-diagnostics-title">Diagnostics</h1>
          <p className="text-muted-foreground">Site traffic analytics and error monitoring</p>
        </div>
        <div className="flex gap-1 border-b" data-testid="tabs-diagnostics">
          {[
            { id: "analytics", label: "Analytics", Icon: BarChart3, testid: "tab-analytics" },
            { id: "errors", label: "Error Logs", Icon: AlertTriangle, testid: "tab-error-logs" },
          ].map(({ id, label, Icon, testid }) => (
            <button key={id}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab(id as "analytics" | "errors")}
              data-testid={testid}>
              <Icon className="h-4 w-4 inline-block mr-2" />{label}
            </button>
          ))}
        </div>
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "errors" && <ErrorLogsTab />}
      </div>
    </DashboardLayout>
  );
}
```

**After replacing this file:** Remove the standalone Analytics page from the sidebar nav and its route in App.tsx. The Diagnostics page now contains both.

---

## Step 10 — Sidebar Cleanup

In `DashboardLayout.tsx` (or wherever sidebar links are defined for the Owner level), remove the standalone "Analytics" link and keep only the "Diagnostics" link pointing to `/dashboard/owner/diagnostics` (or equivalent path for that project).

---

## Environment Variables Checklist

| Variable | What it's for |
|---|---|
| `GA4_PROPERTY_ID` | Numeric GA4 Property ID (NOT the G-XXXXXXXX tag) |
| `PROMO_API_KEY` | Chronic Brands USA API key (also check `CHRONIC_BRANDS_API_KEY`) |

---

## Implementation Order

1. Install `@google-analytics/data` package
2. Create the 4 service files (Steps 1–4)
3. Add the 3 routes to routes.ts + update the 2 payment routes (Steps 5–6)
4. Create PromoRedirect.tsx and add route to App.tsx (Step 7)
5. Add toast interceptor (Step 8)
6. Replace Diagnostics page and clean up sidebar (Steps 9–10)
7. Set environment variables: `GA4_PROPERTY_ID`, `PROMO_API_KEY`
8. Add Firebase service account as GA4 Viewer, enable Google Analytics Data API in GCP
