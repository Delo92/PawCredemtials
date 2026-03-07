# Support Animal Registry - Registered Support Animal Certification Platform

## Overview

This project is a white-label platform designed for registering and certifying support animals. It features a 4-tier user hierarchy, enabling end-to-end management of applications, professional reviews, automated certificate generation, payments, and workflow automation. The platform aims to streamline the process from applicant registration to final certification, supporting a business vision for scalable, customizable support animal registration services.

The core workflow progresses through Registration, Package Selection, Payment, Form Auto-Fill, Professional Review/Approval, Automated Certificate Generation, and ultimately, Completion.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The platform is a full-stack TypeScript application utilizing React for the frontend, Express.js for the backend, and Firebase Firestore for data storage.

### Frontend Architecture
- **Framework**: React 18 with TypeScript, Vite for bundling.
- **Routing**: Wouter.
- **State Management**: TanStack Query (React Query v5).
- **UI/UX**: shadcn/ui built on Radix UI primitives and Tailwind CSS, supporting dark/light modes.
- **Context-based Architecture**: `AuthContext`, `ConfigContext`, and `ThemeProvider` manage global states.
- **Media Management**: Configurable site media (images, videos, Vimeo embeds) through `MediaRenderer.tsx` and Firebase `siteConfig` for various sections (hero, about, CTA, etc.).

### Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Authentication**: Firebase Authentication with stateless Bearer token verification.
- **API**: RESTful endpoints.

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Schema**: Shared `shared/schema.ts` for frontend and backend consistency.
- **Validation**: Zod schemas derived from Drizzle schemas.

### User Hierarchy
A 4-tier role-based system:
1. **Applicant**: Registers animals, submits applications.
2. **Doctor/Reviewer**: Reviews and approves/denies applications (via secure links, no login required).
3. **Admin**: Manages users, registration types, assigns applications, system settings.
4. **Owner**: Full platform control, including white-label configuration.

Role names are configurable per deployment.

### Key Features and Workflow
- **Application Workflow**: A 3-step wizard (Select Package → Your Information → Review & Pay) with profile completeness gate and draft save/restore.
- **Doctor Review System**: Secure, token-based review links for doctors, supporting round-robin assignment.
- **Automated Document Generation**: Certificates are auto-generated upon doctor approval, incorporating doctor credentials.
- **Auto-Message Triggers**: Automated notifications based on application status changes.
- **Owner Configuration**: Comprehensive white-label settings for branding and site content.
- **Admin Management**: Tools for user and application management, including manual payment processing.
- **Gizmo Form System**: Browser-side PDF auto-fill using `pdf-lib` and `pdfjs-dist` for both AcroForm and placeholder PDFs, with PDF template upload and management. Supports `selectedRadioIds` from patient answers and radio position offsets for IDs 6-16.
- **Application Processing**: Automated workflow from applicant submission to doctor review (or auto-completion based on settings) and final certification, with comprehensive email integrations via SendGrid.
- **Per-Doctor State PDFs**: Doctors can have state-specific PDF forms (`stateForms` on doctor profile). The form data endpoint resolves `doctorProfile.stateForms[patientState]` first, then falls back to `doctorProfile.gizmoFormUrl`.
- **Package Radio Button Fields**: Packages support radio-type form fields with `radioOptions` (radioId + statement pairs). Patient sees statement text, stores radioId as value.
- **Authorize.Net Payment Integration**: `server/authorizenet.ts` handles `chargeCard`, Accept.js client-side tokenization. Payment config endpoint provides Accept.js URL and API credentials. Falls back to direct submission when Authorize.Net is not configured.
- **Pet ID Card System**: PDF-based ID card generation using the GizmoForm system. Template PDF uses `{petName}`, `{petBreed}`, `{firstName} {lastName}`, `{registrationId}` placeholders and "Pet Photo Here" text marker for image placement. Pet photos uploaded via `POST /api/upload/pet-photo` to Firebase Storage. Registration IDs auto-generated (format: XXXX-XXXX) on application creation. Image proxy at `/api/forms/proxy-image` handles CORS for pdf-lib embedding.
- **Pet ID Card Template Library**: Named templates stored in `petIdCardTemplates` Firestore collection (fields: id, name, url, createdAt). CRUD via `/api/admin/pet-id-card-templates` endpoints. Owner manages library in Site Settings > Pet Certificates tab (add with name, delete, set as site default). Admin assigns templates to packages via dropdown in Packages page. Template resolution order: package `petIdCardTemplateId` → package `petIdCardTemplateUrl` → `adminSettings.petIdCardTemplateUrl` → `/uploads/templates/pet-id-card-template.pdf`. Deleting a template clears references from both adminSettings default and all packages.
- **Per-Package Pet Details**: Packages have a `requiresPetDetails` boolean field. When enabled, applicants must provide pet type, name, breed, weight, and photo before completing purchase. Pet details UI only shows in application wizard when selected package requires it. Validation enforced at both step transition and final submission.
- **Draft Save/Restore**: Applicant form data auto-saves to `/api/profile/draft-form` with 1s debounce. Restores packageId, reason, customFields, petName, petBreed, petWeight, petType, petPhotoUrl, movingSoon, travelPlanned, and step on page load.
- **Awaiting Payment Status**: Applications with unpaid packages automatically get `awaiting_payment` status on creation. Admin can process payment via `POST /api/admin/applications/:id/process-payment`, which transitions to `pending` and triggers doctor assignment.
- **Qualification Quiz**: Interactive 5-question pre-screening quiz on the homepage (`QualificationQuiz.tsx`) that helps visitors determine ESA eligibility before registering.
- **Pet Details Collection**: Application step 2 collects pet type, name, breed, and weight. Included in form data, draft saves, and email summaries.
- **Urgency Questions**: Application step 2 asks "Moving in next 2 months?" and "Trips planned?" to help prioritize applications.
- **Benefits Highlights**: Motivational info cards displayed between application wizard steps (Fair Housing Act rights, ESA benefits, pet fee elimination).
- **Doctor Rotation Exclusion**: Test doctor profiles (level2@test.com) are excluded from round-robin assignment via `excludeFromRotation` flag on doctor profiles. `getActiveDoctors()` filters these out.
- **Doctor Letter Templates**: Each doctor can have a `letterTemplateUrl` on their profile — a PDF letter template uploaded via `POST /api/admin/doctor-templates/:doctorProfileId/letter-template`. The letter uses the same GizmoForm auto-fill system with placeholders for patient/doctor data. The form data endpoint (`/api/forms/data/:applicationId`) returns `letterTemplateUrl` from the assigned doctor's profile. The FormViewerPage shows up to 3 tabs: PDF Form, ESA Letter, and Pet ID Card.
- **Commission System**: Two flat-rate commission types, both configurable from the admin Commissions page:
  1. **Doctor Review Fee**: Flat dollar amount paid to doctors per approved review. Commission created automatically when doctor approves an application (all 5 approval code paths). Stored in cents in `commissionSettings.doctorReviewFee`.
  2. **Referral Payout**: Flat dollar amount paid to referrers when a referred applicant's application is completed. Checks `user.referredByUserId`. Stored in cents in `commissionSettings.referralPayoutAmount`.
  - Commission records stored in `commissions` Firestore collection with `commissionType` field ("doctor_review" or "referral").
  - Settings API: `GET/PUT /api/admin/commission-settings` (level 3+). Commissions list: `GET /api/commissions` (own) or `GET /api/admin/commissions` (all).
  - Duplicate prevention: checks existing commissions before creating to avoid double-crediting.

- **Referral Tracking System**: Each user gets a unique `referralCode` on registration. When someone registers with `?ref=CODE`, they're linked via `referredByUserId`. Doctors see their own referrals on their Referrals page (`/api/referrals/my-referrals`). Admins/Owners see platform-wide referral data with expandable referrer rows (`/api/admin/referrals`). Referral commissions auto-created when referred user's application is completed.
- **System Referral Codes**: Admins can create referral codes for external people (non-users) with name + email via `POST /api/admin/system-referral-codes`. Stored in `systemReferralCodes` Firestore collection with fields: name, email, code, useCount, isActive. When someone registers with a system code, `referredByUserId` is set to `system:<codeId>`. System referrals do NOT create commission records. Use count incremented atomically via `FieldValue.increment(1)`. CRUD endpoints: `GET/POST /api/admin/system-referral-codes`, `DELETE /api/admin/system-referral-codes/:id`.
- **Referral Email Notifications**: `sendReferralUsedEmail()` in `server/email.ts` sends an email to the referrer (user or external) every time someone signs up using their code. Emails sent after successful user creation to prevent false positives. Referral codes normalized to uppercase on lookup.

### API Endpoints
Key endpoints exist for authentication, user profiles, site configuration, package management, application submission, doctor review processes, admin and owner functionalities, form data handling, payment processing (`/api/payment/config`, `/api/payment/charge`), draft form persistence (`/api/profile/draft-form`), admin payment processing (`/api/admin/applications/:id/process-payment`), pet photo upload (`/api/upload/pet-photo`), image proxy (`/api/forms/proxy-image`), commission settings (`/api/admin/commission-settings`), referral tracking (`/api/referrals/my-referrals`, `/api/admin/referrals`), and system referral codes (`/api/admin/system-referral-codes`).

## External Dependencies

### Database
- **Firebase Firestore**: Primary data store.
- **PostgreSQL**: Used with Drizzle ORM.

### Frontend Libraries
- **UI Framework**: shadcn/ui (Radix UI + Tailwind CSS).
- **Forms**: react-hook-form with Zod resolvers.
- **Date Handling**: date-fns.
- **Charts**: Recharts.
- **PDF Manipulation**: pdf-lib (write/fill PDFs), pdfjs-dist (parse text).

### Backend Libraries
- **Authentication**: bcryptjs for password hashing.
- **File Uploads**: multer for multipart form data.

### Services
- **SendGrid**: For transactional email notifications (doctor approval emails, admin notifications, patient approvals).