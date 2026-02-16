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
  galleryImages?: string[];
  levelNames: {
    level1: string;
    level2: string;
    level3: string;
    level4: string;
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
  siteName: "Support Animal Registry",
  tagline: "Fast, trusted support animal registration and certification",
  description: "Get your registered support animal certification quickly and easily. Verified by licensed professionals, legally recognized, and delivered digitally.",
  primaryColor: "#3b82f6",
  secondaryColor: "#6366f1",
  accentColor: "#0ea5e9",
  heroTitle: "Register Your Support Animal Today",
  heroSubtitle: "Need an official support animal registration? We provide fast, legitimate ESA letters and certifications with quick turnaround times. Trusted, secure, and hassle-free.",
  heroButtonText: "Get Started",
  heroButtonLink: "/register",
  heroSecondaryButtonText: "View Packages",
  heroSecondaryButtonLink: "/packages",
  footerQuickLinks: [
    { label: "Home", url: "/" },
    { label: "Packages", url: "/packages" },
    { label: "How It Works", url: "/#how-it-works" },
    { label: "Contact", url: "/contact" }
  ],
  footerLegalLinks: [
    { label: "Privacy Policy", url: "/privacy" },
    { label: "Terms of Service", url: "/terms" },
    { label: "Disclaimer", url: "/disclaimer" }
  ],
  levelNames: {
    level1: "Applicant",
    level2: "Reviewer",
    level3: "Admin",
    level4: "Owner",
  },
  workflowSteps: [
    "Create Account",
    "Select Registration Type",
    "Payment",
    "Provide Details",
    "Professional Review",
    "Certificate Issued",
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
  ADMIN: 3,
  OWNER: 4,
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
