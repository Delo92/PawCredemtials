# URL Referral Code Auto-Fill Pattern

## What This Does

When a user visits a URL like `yoursite.com/DEANA` or `yoursite.com/get25off`, the slug after the slash is captured as a referral/promo code and automatically pre-filled into a booking or intake form on the page. The user never has to type it manually.

Works with any slug: names, phrases, discount codes, campaign codes — anything.

---

## The 3 Files You Need to Change

### 1. Router (`App.tsx` or equivalent)

Add a wildcard route **after** all your specific sub-routes so they don't get caught first.

```tsx
// Specific routes first
<Route path="/OlyLife/products" element={<OlyLifeProducts />} />
<Route path="/OlyLife/terms" element={<OlyLifeTerms />} />

// Referral catch-all LAST — captures /OlyLife/ANYTHING
<Route path="/OlyLife/:referralCode" element={<OlyLife />} />
```

The param name (`referralCode`) is arbitrary — just keep it consistent across all three files.

---

### 2. Page Component (`OlyLife.tsx` or equivalent)

**Add the import:**
```tsx
import { useParams } from "react-router-dom";
```

**Read the param inside the component:**
```tsx
export default function OlyLife() {
  const { referralCode } = useParams<{ referralCode?: string }>();
  // ... rest of your state
```

**Pass it down to the form:**
```tsx
<OlyLifeIntakeForm
  isOpen={intakeFormOpen}
  onClose={() => setIntakeFormOpen(false)}
  referralCode={referralCode}   // <-- add this
/>
```

---

### 3. Form Component (`OlyLifeIntakeForm.tsx` or equivalent)

**Add to the props interface:**
```tsx
interface OlyLifeIntakeFormProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode?: string;   // <-- add this
}
```

**Accept it in the function signature and initialize state with it:**
```tsx
export default function OlyLifeIntakeForm({ isOpen, onClose, referralCode }: OlyLifeIntakeFormProps) {
  const [promoCode, setPromoCode] = useState(referralCode ? referralCode.toUpperCase() : "");
  const [showPromo, setShowPromo] = useState(!!referralCode); // auto-open field if code present
```

**Add a useEffect to stay in sync if the prop changes:**
```tsx
useEffect(() => {
  if (referralCode) {
    setPromoCode(referralCode.toUpperCase());
    setShowPromo(true);
  }
}, [referralCode]);
```

**Rename the toggle label:**
```tsx
{showPromo ? "Remove promo/referral code" : "Have a promo/referral code?"}
```

**Make sure the code is sent with the form submission:**
```tsx
fetch("/api/your-intake-endpoint", {
  method: "POST",
  body: JSON.stringify({
    // ...other fields
    ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}),
  }),
});
```

---

## How the Backend Uses It

The `promoCode` field arrives in the POST body like any other field. Store it on the record and optionally fire a webhook to track the redemption. No special backend routing is needed — the slug is purely a frontend concern.

---

## Key Rules

- Specific routes must come **before** the `/:referralCode` catch-all or they will be swallowed by it.
- The `!!referralCode` boolean trick auto-opens the promo field when a code is present so the user can see it was applied.
- `.toUpperCase()` is optional but keeps codes consistent for tracking.
- The `useEffect` sync ensures if someone navigates between referral links without unmounting the component, the code updates correctly.
