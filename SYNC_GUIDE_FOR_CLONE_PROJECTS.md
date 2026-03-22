# Sync Guide — Bringing Clone Projects Up to Spec

This document covers everything done on the **primary project** (Paw Credentials / Support Animal Registry) that clone projects need to implement to be fully in sync. Each section is self-contained and copy-paste ready. Swap credentials where noted.

Read the companion file `DIAGNOSTICS_IMPLEMENTATION_GUIDE.md` in this repo for the full GA4 + Error Logs implementation. This document covers what has been added or changed **since** that guide was written.

---

## What to Check First

Before implementing anything, verify whether each feature already exists in your project:

| Feature | How to check |
|---------|-------------|
| Toast auto-logging | Does `client/src/hooks/use-toast.ts` import `logClientError`? |
| Chronic Brands promo webhook | Does `server/services/chronicBrands.ts` exist? |
| Promo code URL capture | Does `client/src/pages/PromoRedirect.tsx` exist? |
| GA4 Data API (server-side) | Does `server/services/ga4Analytics.ts` exist? |
| Error logger | Does `server/services/errorLogger.ts` exist? |

---

## 1. Toast Auto Error Logging

**What it does:** Every destructive (red error) toast shown anywhere in the app is automatically sent to the server error log. Zero changes to individual components — it intercepts at the single `toast()` function level.

**File: `client/src/hooks/use-toast.ts`**

Add this import at the top of the file:

```typescript
import { logClientError } from "@/lib/clientErrorLogger"
```

Then find the `function toast({ ...props }: Toast)` function and add this block **before** the `const update = ...` line:

```typescript
function toast({ ...props }: Toast) {
  const id = genId()

  // AUTO ERROR LOGGING — intercept destructive toasts and send to error log
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

  const update = (props: ToasterToast) =>
  // ... rest of the function stays the same
```

**Requires:** `client/src/lib/clientErrorLogger.ts` must exist (see `DIAGNOSTICS_IMPLEMENTATION_GUIDE.md` Section 4).

---

## 2. Chronic Brands Promo Code Webhook

**What it does:** When a user completes a purchase with a promo/referral code, the backend silently calls the Chronic Brands USA tracking webhook to log the redemption for payout calculations.

### 2a. Environment Variable

Store the API key as a secret named `PROMO_API_KEY` (or `CHRONIC_BRANDS_API_KEY` — the service checks both).

### 2b. New Service File

**Create: `server/services/chronicBrands.ts`**

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
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        code: data.code,
        brandName: "YOUR BRAND NAME HERE",       // ← change per project
        platform: "YOUR PLATFORM NAME HERE",     // ← change per project
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

### 2c. Import in routes.ts

Add to the imports at the top of `server/routes.ts`:

```typescript
import { trackPromoRedemption } from "./services/chronicBrands";
```

### 2d. Wire into the Payment Charge Route

In `server/routes.ts`, find `app.post("/api/payment/charge", ...)`.

**Change the destructuring line** to include `promoCode`:
```typescript
const { opaqueDataDescriptor, opaqueDataValue, packageId, formData, promoCode } = req.body;
```

**After the application workflow steps are created** (the `for` loop that calls `storage.createApplicationStep`), add:
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

### 2e. Wire into the Manual Application Route

In `server/routes.ts`, find `app.post("/api/applications", ...)`.

**Change the destructuring line** to include `promoCode`:
```typescript
const { packageId, formData, paymentStatus: reqPaymentStatus, autoSendToDoctor, promoCode } = req.body;
```

**After the workflow steps loop**, add:
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

## 3. Promo Code URL Capture (`/DEANA` style links)

**What it does:** Visiting `yourdomain.com/DEANA` stores `DEANA` in localStorage and redirects to the home page. The code auto-fills at checkout. Users can also type one manually. After purchase the code is cleared from storage.

### 3a. New Page Component

**Create: `client/src/pages/PromoRedirect.tsx`**

```tsx
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

### 3b. Add Route in App.tsx

Add the import at the top with other lazy imports:
```tsx
const PromoRedirect = lazy(() => import("@/pages/PromoRedirect"));
```

Add this route **before** the final fallback `<Route>` (the NotFound one), but **after** all other named routes including `/review/:token`:
```tsx
{/* Promo/referral code capture — e.g. yourdomain.com/DEANA */}
<Route path="/:promoCode">
  <AppShell><PromoRedirect /></AppShell>
</Route>
```

> **Important:** This must be LAST before the NotFound fallback. Wouter matches in order, so all named routes above it take priority.

### 3c. Promo Code UI in the Checkout (NewApplication.tsx)

In the checkout/payment step (Step 3), you need:

**1. Add state** (near other useState declarations):
```tsx
const [promoCode, setPromoCode] = useState(() => localStorage.getItem("promoCode") || "");
```

**2. Add icons to the lucide-react import:**
```tsx
import { ..., Tag, X } from "lucide-react";
```

**3. Add the promo code card** in Step 3, right before the payment card:
```tsx
<Card data-testid="card-promo-code">
  <CardHeader className="pb-3">
    <CardTitle className="flex items-center gap-2 text-base">
      <Tag className="h-4 w-4" />
      Promo / Referral Code
    </CardTitle>
    <CardDescription>
      Have a referral or promo code? It will be applied to your order.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex gap-2">
      <Input
        placeholder="e.g., DEANA"
        value={promoCode}
        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
        className="uppercase font-mono tracking-wider"
        data-testid="input-promo-code"
      />
      {promoCode && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            setPromoCode("");
            localStorage.removeItem("promoCode");
          }}
          data-testid="button-clear-promo"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
    {promoCode && (
      <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
        <Check className="h-3 w-3" />
        Code <span className="font-semibold">{promoCode}</span> will be applied to your order
      </p>
    )}
  </CardContent>
</Card>
```

**4. Pass promoCode in the payment charge API call:**
```typescript
const chargeRes = await apiRequest("POST", "/api/payment/charge", {
  opaqueDataDescriptor: response.opaqueData.dataDescriptor,
  opaqueDataValue: response.opaqueData.dataValue,
  packageId: selectedPackage.id,
  formData: buildFormData(),
  promoCode: promoCode || undefined,   // ← add this
});
// After getting result:
if (promoCode) localStorage.removeItem("promoCode");
```

**5. Pass promoCode in the manual application API call** (non-payment-configured path):
```typescript
const response = await apiRequest("POST", "/api/applications", {
  packageId: selectedPackage.id,
  formData: buildFormData(),
  autoSendToDoctor: true,
  paymentStatus: "paid",
  promoCode: promoCode || undefined,   // ← add this
});
if (promoCode) localStorage.removeItem("promoCode");
```

---

## 4. GA4 Data API (Server-Side Analytics)

If your project only has the GA4 tracking tag in `index.html` but no server-side analytics data in the Diagnostics page, implement the full server-side Data API by following **`DIAGNOSTICS_IMPLEMENTATION_GUIDE.md`** Sections 1–3.

Key differences to check:
- Does `server/services/ga4Analytics.ts` exist? If not, create it (see guide Section 2)
- Does `/api/admin/ga4-analytics` route exist in `server/routes.ts`? If not, add it (see guide Section 3)
- Is `GA4_PROPERTY_ID` set as an environment variable?
- Is the Firebase service account email added as a **Viewer** on the GA4 property?
- Is the **Google Analytics Data API** enabled in Google Cloud Console?

Each project needs its own GA4 Property ID. The Measurement ID in `index.html` (G-XXXXXXXX) is different from the numeric Property ID needed for the Data API.

---

## 5. Diagnostics Tab Structure

This project merged Analytics and Error Logs into a single tabbed Diagnostics page. If your project has them as separate sidebar items, you have two options:

**Option A (match this project exactly):** Remove the standalone Analytics page and sidebar item. Merge both into `Diagnostics.tsx` as tabs (Analytics tab + Error Logs tab). Reference `DIAGNOSTICS_IMPLEMENTATION_GUIDE.md` Section 5 for the full component code.

**Option B (keep them separate):** Leave the structure as-is. Both approaches work — it's a UI preference. Just make sure both pages pull real data from the API endpoints.

---

## Summary Checklist

- [ ] `use-toast.ts` imports `logClientError` and intercepts destructive toasts
- [ ] `server/services/chronicBrands.ts` exists
- [ ] `PROMO_API_KEY` secret is set
- [ ] `brandName` and `platform` in `chronicBrands.ts` updated for this project
- [ ] `/api/payment/charge` route extracts and passes `promoCode` to webhook
- [ ] `/api/applications` route extracts and passes `promoCode` to webhook
- [ ] `client/src/pages/PromoRedirect.tsx` exists
- [ ] `/:promoCode` route added to `App.tsx` (after all named routes, before NotFound)
- [ ] Checkout (Step 3) has promo code input with localStorage read/clear
- [ ] GA4 Data API wired up with correct Property ID for this project
- [ ] Firebase service account has Viewer access on this project's GA4 property
