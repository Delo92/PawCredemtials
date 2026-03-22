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
