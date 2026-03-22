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
        brandName: "Paw Credentials",
        platform: "Paw Credentials Website",
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
