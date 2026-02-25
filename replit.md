# Support Animal Registry - Registered Support Animal Certification Platform

## Overview

This is a white-label support animal registration and certification service with a 4-tier user hierarchy. The platform handles applicant registrations, professional review/approval, automated certificate generation, payments, messaging, and workflow automation. Built as a full-stack TypeScript application with React frontend, Express backend, and Firebase Firestore for data storage.

The core workflow follows: Registration → Package Selection → Payment → Form Auto-Fill → Professional Review/Approval → Auto-Certificate Generation → Completion.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, bundled with Vite
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query (React Query v5) for server state
- **UI Components**: shadcn/ui with Radix UI primitives and Tailwind CSS
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Code Splitting**: Lazy-loaded pages with React.lazy() and Suspense

The frontend uses a context-based architecture:
- `AuthContext` - User authentication state and methods
- `ConfigContext` - White-label configuration (site name, colors, role names)
- `ThemeProvider` - Dark/light theme management

Path aliases are configured: `@/` for client/src, `@shared/` for shared code, `@assets/` for attached assets.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Authentication**: Firebase Authentication with Bearer token verification (stateless, no server-side sessions)
- **API Pattern**: RESTful endpoints under `/api/` prefix

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Migrations**: Drizzle Kit with `db:push` command for schema sync
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod

### User Hierarchy (4 Levels)
1. **Level 1 - Applicant**: End users who register support animals and submit applications
2. **Level 2 - Doctor/Reviewer**: Reviews applications via secure email links (no login required), approves/denies
3. **Level 3 - Admin**: Manage users, registration types, assign applications to doctors, and system settings
4. **Level 4 - Owner**: Full platform control, white-label configuration

Role names are configurable per deployment via the `siteConfig` table.

### Key Data Models
- `users` - All platform users with role levels
- `packages` - Service offerings with pricing
- `applications` - User applications linked to packages
- `applicationSteps` - Workflow step tracking
- `documents` - File uploads and document management
- `messages` - Internal messaging system
- `payments` - Payment records
- `commissions` - Referral/agent commission tracking
- `notifications` - User notifications
- `activityLogs` - Audit trail
- `siteConfig` - White-label customization
- `doctorProfiles` - Doctor credentials (license, NPI, DEA, phone, fax, address, specialty)
- `doctorReviewTokens` - Secure single-use tokens for doctor review links (token, applicationId, doctorId, status, expiresAt)
- `autoMessageTriggers` - Automated messages triggered on application status changes
- `adminSettings` - Admin settings including `lastAssignedDoctorId` for round-robin doctor assignment

### Site Media Management
All landing page images are configurable from the Owner's Site Settings > Site Media tab. Each slot supports:
- **Image URLs** (.jpg, .png, .webp, .gif)
- **Video URLs** (.mp4, .webm) - autoplay, loop, muted
- **Vimeo embeds** (paste vimeo.com link, auto-converted to embed)

Configurable media slots stored in Firebase `siteConfig`:
- `heroMediaUrl` - Hero section background
- `aboutMediaUrl` - About section image
- `ctaMediaUrl` - CTA section background
- `contactMediaUrl` - Contact/footer CTA background
- `departmentMediaUrls[]` - Department section images (5 slots)
- `testimonialMediaUrls[]` - Testimonial profile images (5 slots)
- `galleryImages[]` - Gallery section (unlimited slots)

Component: `client/src/components/MediaRenderer.tsx` - detects type from URL and renders img/video/iframe.

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Vite builds to `dist/public`, esbuild bundles server to `dist/index.cjs`
- **Bundling Strategy**: Server dependencies in allowlist are bundled to reduce cold start times

## External Dependencies

### Database
- **Firebase Firestore**: Primary data store via Firebase Admin SDK
- **Connection**: Firebase service account key via `FIREBASE_SERVICE_ACCOUNT_KEY` secret

### Frontend Libraries
- **UI Framework**: shadcn/ui (Radix UI + Tailwind)
- **Forms**: react-hook-form with @hookform/resolvers and Zod
- **Date Handling**: date-fns
- **Charts**: Recharts (via shadcn chart component)

### Backend Libraries
- **Authentication**: bcryptjs for password hashing
- **File Uploads**: multer for multipart form data (gallery image uploads stored in `uploads/gallery/`)

### Development Tools
- **Replit Plugins**: @replit/vite-plugin-runtime-error-modal, cartographer, dev-banner
- **TypeScript**: Strict mode with module bundler resolution

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (required)
- `VITE_FIREBASE_*` - Optional Firebase configuration for enhanced auth
- `SENDGRID_API_KEY` - SendGrid API key for transactional emails
- `SENDGRID_FROM_EMAIL` - Sender email address for SendGrid (default: noreply@pawcredentials.com)

## Current Implementation Status

### Completed Features
- **Authentication**: Stateless Firebase token-based auth (no server-side sessions)
- **4 Role-Based Dashboards**: Each with unique stats, actions, and navigation
- **Application Workflow**: 3-step wizard for creating new applications
- **Package Management**: Browse and select service packages with custom form fields per package
- **Doctor Review System**: Secure token-based review links sent to doctors (no login required)
- **Round-Robin Doctor Assignment**: Admin sends applications to doctors with automatic rotation
- **Auto Document Generation**: Documents auto-generated upon doctor approval with doctor credentials
- **Auto-Message Triggers**: Automated messages on status changes
- **Owner Configuration**: Full white-label settings (branding, role names, contact info)
- **Admin User Management**: Search, filter, and edit user levels/status
- **Dark/Light Theme**: System-aware with manual toggle
- **Extended Registration**: Full patient profile collection (name, DOB, address, medical info, SSN, veteran status, 4 consent checkboxes)
- **Profile Completeness Gate**: Applications blocked until profile is complete (green/amber banner)
- **Auto-Fill Applications**: Profile data auto-fills into application formData on submit
- **Auto-Send to Doctor**: Applications auto-sent to doctor via round-robin when payment is marked "paid"
- **SendGrid Email Integration**: Doctor approval emails, admin notification emails, patient approval emails via `server/email.ts`
- **Admin Notification Email**: Configurable notification email in Settings (Level 3+)
- **Custom Form Fields per Package**: Admin can define custom fields (text/textarea/select/date/email/phone/number) per package

### Application Processing Workflow

The complete automated workflow:

1. Level 1 (Applicant) creates account with full profile (name, DOB, address, medical info, 4 consents)
2. Applicant completes profile on dashboard (profile completeness gate blocks applications)
3. Applicant selects ESA package, application auto-fills profile data
4. On submit with `paymentStatus: "paid"`, system auto-assigns doctor via round-robin
   - Generates secure one-time review link (expires 7 days)
   - Sends doctor email via SendGrid with "Review & Approve" button
   - Sends admin notification email to configured address
   - Application status → `doctor_review`
5. Doctor clicks email link → public review portal (no login needed)
   - Reviews patient info, form data, package details
   - **Approves** → `doctor_approved` → auto-generates certificate → emails patient
   - **Denies** → `doctor_denied` → patient notified with reason
6. Upon approval, patient receives email with link to dashboard to view documents
7. Admin can also manually send/resend to doctor via "Send to Doctor" button (also triggers emails)

**Application Status Values:**
- `pending` - New application, ready to be sent to doctor
- `doctor_review` - Sent to doctor, awaiting their decision
- `doctor_approved` - Approved by doctor, certificate generated
- `doctor_denied` - Denied by doctor
- `level3_work` - In admin work queue (optional processing)
- `completed` - Fully completed
- `rejected` - Application rejected

### Doctor Review Token System
- **Secure Tokens**: 32-byte hex tokens, single-use, expire in 7 days
- **Public Review Portal**: `/review/:token` - no authentication required
- **Round-Robin Assignment**: `adminSettings.lastAssignedDoctorId` tracks rotation
- **Auto-Assignment**: Cycles through active doctors fairly (like a draft system)
- **Manual Override**: Admin can specify a particular doctor when sending

### API Endpoints
- `POST /api/auth/register` - User registration (accepts full profile fields + consents)
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `GET /api/profile` - Get current user's full profile (authenticated)
- `PUT /api/profile` - Update current user's profile (authenticated)
- `GET /api/admin/settings` - Get admin settings including notificationEmail (Level 3+)
- `PUT /api/admin/settings` - Update admin settings (Level 3+)
- `GET /api/config` - Get site configuration
- `GET /api/packages` - List active packages
- `GET /api/applications` - Get user's applications
- `POST /api/applications` - Create new application
- `POST /api/admin/applications/:id/send-to-doctor` - Send application to doctor (round-robin or manual), generates review token (Level 3+)
- `GET /api/review/:token` - Public: Load application data for doctor review (no auth)
- `POST /api/review/:token/decision` - Public: Submit doctor's approve/deny decision (no auth)
- `GET /api/doctors` - List active doctors (Level 3+)
- `GET /api/doctors/stats` - Get doctor's review stats and token history (Level 2+)
- `GET /api/review-tokens` - Get review tokens for an application (Level 3+)
- `GET /api/commissions` - Get commissions (Level 2+)
- `GET /api/admin/users` - List all users (Level 3+)
- `PUT /api/admin/users/:id` - Update user (Level 3+)
- `GET /api/admin/applications` - List all applications (Level 3+)
- `PUT /api/owner/config` - Update site config (Level 4)

### Key Routes
- `/` - Landing page
- `/login`, `/register` - Authentication
- `/packages` - Service packages listing
- `/review/:token` - Public doctor review portal (no auth required)
- `/dashboard/applicant` - Applicant dashboard
- `/dashboard/applicant/applications/new` - New application wizard
- `/dashboard/doctor` - Doctor dashboard with review history
- `/dashboard/doctor/reviews` - Doctor's completed reviews
- `/dashboard/admin` - Admin dashboard
- `/dashboard/admin/applications` - All applications with "Send to Doctor" action
- `/dashboard/admin/users` - User management
- `/dashboard/owner` - Owner dashboard
- `/dashboard/owner/site-settings` - White-label configuration