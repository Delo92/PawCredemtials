// White-label configuration defaults
// These can be overridden per deployment via environment variables or database settings

export interface FooterLink {
  label: string;
  url: string;
}

export interface WhiteLabelConfig {
  siteName: string;
  tagline: string;
  description: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroBackgroundUrl?: string;
  heroMediaUrl?: string;
  heroButtonText?: string;
  heroButtonLink?: string;
  heroSecondaryButtonText?: string;
  heroSecondaryButtonLink?: string;
  footerQuickLinks?: FooterLink[];
  footerLegalLinks?: FooterLink[];
  footerText?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  levelNames: {
    level1: string;
    level2: string;
    level3: string;
    level4: string;
    level5: string;
  };
  workflowSteps: string[];
  features: {
    enableMessaging: boolean;
    enableDocumentUpload: boolean;
    enablePayments: boolean;
    enableReferrals: boolean;
    enableNotifications: boolean;
  };
}

export const defaultConfig: WhiteLabelConfig = {
  siteName: "Doctor's Note",
  tagline: "Fast, discreet medical documentation when you need it",
  description: "Get legitimate doctor's notes for work, school, or personal needs. Quick approval, secure delivery, and complete privacy.",
  primaryColor: "#3b82f6",
  secondaryColor: "#6366f1",
  accentColor: "#0ea5e9",
  heroTitle: "Get Your Doctor's Note Today",
  heroSubtitle: "Need documentation for work or school? We provide fast, legitimate medical notes with quick turnaround times. Discreet, secure, and hassle-free.",
  heroButtonText: "Get Your Note",
  heroButtonLink: "/register",
  heroSecondaryButtonText: "View Pricing",
  heroSecondaryButtonLink: "/packages",
  footerQuickLinks: [
    { label: "Home", url: "/" },
    { label: "Pricing", url: "/packages" },
    { label: "How It Works", url: "/#how-it-works" },
    { label: "Contact", url: "/contact" }
  ],
  footerLegalLinks: [
    { label: "Privacy Policy", url: "/privacy" },
    { label: "Terms of Service", url: "/terms" },
    { label: "Disclaimer", url: "/disclaimer" }
  ],
  levelNames: {
    level1: "Customer",
    level2: "Medical Staff",
    level3: "Agent",
    level4: "Admin",
    level5: "Owner",
  },
  workflowSteps: [
    "Create Account",
    "Select Note Type",
    "Payment",
    "Provide Details",
    "Medical Review",
    "Note Issued",
    "Delivered"
  ],
  features: {
    enableMessaging: true,
    enableDocumentUpload: true,
    enablePayments: true,
    enableReferrals: true,
    enableNotifications: true,
  },
};

// User level constants
export const USER_LEVELS = {
  APPLICANT: 1,
  REVIEWER: 2,
  AGENT: 3,
  ADMIN: 4,
  OWNER: 5,
} as const;

export type UserLevel = typeof USER_LEVELS[keyof typeof USER_LEVELS];

// Application status constants
export const APPLICATION_STATUS = {
  PENDING: "pending",
  IN_REVIEW: "in_review",
  AWAITING_DOCUMENTS: "awaiting_documents",
  AWAITING_PAYMENT: "awaiting_payment",
  APPROVED: "approved",
  REJECTED: "rejected",
  COMPLETED: "completed",
} as const;

export type ApplicationStatus = typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS];

// Payment status constants
export const PAYMENT_STATUS = {
  UNPAID: "unpaid",
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

// Queue entry status constants
export const QUEUE_STATUS = {
  WAITING: "waiting",
  CLAIMED: "claimed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  EXPIRED: "expired",
} as const;

export type QueueStatus = typeof QUEUE_STATUS[keyof typeof QUEUE_STATUS];

// Commission status constants
export const COMMISSION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  PAID: "paid",
  REJECTED: "rejected",
} as const;

export type CommissionStatus = typeof COMMISSION_STATUS[keyof typeof COMMISSION_STATUS];
