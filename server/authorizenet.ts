const AUTHORIZENET_API_LOGIN_ID = process.env.AUTHORIZENET_API_LOGIN_ID || "";
const AUTHORIZENET_TRANSACTION_KEY = process.env.AUTHORIZENET_TRANSACTION_KEY || "";

const API_URL = process.env.AUTHORIZENET_SANDBOX === "true"
  ? "https://apitest.authorize.net/xml/v1/request.api"
  : "https://api.authorize.net/xml/v1/request.api";

export function isAuthorizeNetConfigured(): boolean {
  return !!(AUTHORIZENET_API_LOGIN_ID && AUTHORIZENET_TRANSACTION_KEY);
}

export function getAcceptJsUrl(): string {
  return process.env.AUTHORIZENET_SANDBOX === "true"
    ? "https://jstest.authorize.net/v1/Accept.js"
    : "https://js.authorize.net/v1/Accept.js";
}

export function getApiLoginId(): string {
  return AUTHORIZENET_API_LOGIN_ID;
}

interface ChargeResult {
  success: boolean;
  transactionId?: string;
  authCode?: string;
  message: string;
  responseCode?: string;
}

export async function chargeCard(params: {
  opaqueDataDescriptor: string;
  opaqueDataValue: string;
  amount: number;
  orderId?: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  description?: string;
}): Promise<ChargeResult> {
  if (!isAuthorizeNetConfigured()) {
    throw new Error("Authorize.Net is not configured");
  }

  const amountStr = (params.amount / 100).toFixed(2);

  const requestBody: any = {
    createTransactionRequest: {
      merchantAuthentication: {
        name: AUTHORIZENET_API_LOGIN_ID,
        transactionKey: AUTHORIZENET_TRANSACTION_KEY,
      },
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: amountStr,
        payment: {
          opaqueData: {
            dataDescriptor: params.opaqueDataDescriptor,
            dataValue: params.opaqueDataValue,
          },
        },
        order: params.orderId ? {
          invoiceNumber: params.orderId.slice(0, 20),
          description: (params.description || "ESA Application").slice(0, 255),
        } : undefined,
        customer: params.customerEmail ? {
          email: params.customerEmail,
        } : undefined,
        billTo: (params.customerFirstName || params.customerLastName) ? {
          firstName: (params.customerFirstName || "").slice(0, 50),
          lastName: (params.customerLastName || "").slice(0, 50),
        } : undefined,
      },
    },
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const text = await response.text();
    const cleanText = text.replace(/^\uFEFF/, "");
    const result = JSON.parse(cleanText);

    const txResponse = result?.transactionResponse;
    const messages = result?.messages;

    if (messages?.resultCode === "Ok" && txResponse?.responseCode === "1") {
      return {
        success: true,
        transactionId: txResponse.transId,
        authCode: txResponse.authCode,
        responseCode: txResponse.responseCode,
        message: "Payment processed successfully",
      };
    }

    let errorMessage = "Payment failed";
    if (txResponse?.errors?.length > 0) {
      errorMessage = txResponse.errors[0].errorText;
    } else if (messages?.message?.length > 0) {
      errorMessage = messages.message[0].text;
    }

    return {
      success: false,
      responseCode: txResponse?.responseCode,
      message: errorMessage,
    };
  } catch (error: any) {
    console.error("Authorize.Net API error:", error);
    return {
      success: false,
      message: error.message || "Payment processing error",
    };
  }
}
