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
- **Session Management**: express-session with server-side storage
- **Authentication**: Custom session-based auth with bcrypt password hashing
- **API Pattern**: RESTful endpoints under `/api/` prefix

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Migrations**: Drizzle Kit with `db:push` command for schema sync
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod

### User Hierarchy (4 Levels)
1. **Level 1 - Applicant**: End users who register support animals and submit applications
2. **Level 2 - Reviewer**: Reviews applications, approves/denies, handles work queue
3. **Level 3 - Admin**: Manage users, registration types, verification queue, and system settings
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
- `autoMessageTriggers` - Automated messages triggered on application status changes

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
- **Sessions**: express-session with connect-pg-simple for PostgreSQL session store
- **File Uploads**: multer for multipart form data (gallery image uploads stored in `uploads/gallery/`)

### Development Tools
- **Replit Plugins**: @replit/vite-plugin-runtime-error-modal, cartographer, dev-banner
- **TypeScript**: Strict mode with module bundler resolution

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (required)
- `SESSION_SECRET` - Session encryption key (defaults to dev value)
- `VITE_FIREBASE_*` - Optional Firebase configuration for enhanced auth

## Current Implementation Status

### Completed Features
- **Authentication**: Session-based login/registration with bcrypt password hashing
- **5 Role-Based Dashboards**: Each with unique stats, actions, and navigation
- **Application Workflow**: 3-step wizard for creating new applications
- **Package Management**: Browse and select service packages with "Requires Level 2 Interaction" toggle
- **Call Queue System**: Pooled voice call queue where Level 1 users join queue, Level 2 users claim and handle calls
- **Owner Configuration**: Full white-label settings (branding, role names, contact info)
- **Admin User Management**: Search, filter, and edit user levels/status
- **Dark/Light Theme**: System-aware with manual toggle

### Application Processing Workflow

The complete workflow for processing applications through the platform:

**Flow A: Package REQUIRES Level 2 Interaction**
1. Level 1 purchases package → creates application
2. Level 1 joins call queue
3. Level 2 claims caller, conducts call, then **approves or denies**
   - If **approved** → Application moves to Level 3 work queue
   - If **denied** → Application is rejected
4. Level 3 claims application, does their work, marks complete
5. Level 4 verifies and confirms → Application completed

**Flow B: Package does NOT require Level 2 Interaction**
1. Level 1 purchases package → creates application
2. Application goes **directly** to Level 3 work queue
3. Level 3 claims application, does their work, marks complete
4. Level 4 verifies and confirms → Application completed

**Application Status Values:**
- `pending` - New application
- `level2_review` - Waiting for Level 2 review
- `level2_approved` - Approved by Level 2
- `level2_denied` - Denied by Level 2
- `level3_work` - In Level 3 work queue
- `level3_complete` - Level 3 work done
- `level4_verification` - Pending Level 4 verification
- `completed` - Fully completed
- `rejected` - Application rejected

### Call Queue System (Voice Consultation)
- **Level 1 (Applicant)**: Can join call queue, see position, leave queue
- **Level 2 (Reviewer)**: Pooled queue - any reviewer can claim callers, start calls, complete calls with outcomes (approved/denied)
- **Integration Ready**: Schema includes roomId, roomToken fields for Twilio/GHL voice integration

### API Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `GET /api/config` - Get site configuration
- `GET /api/packages` - List active packages
- `GET /api/applications` - Get user's applications
- `POST /api/applications` - Create new application
- `GET /api/queue` - Get review queue (Level 2+)
- `GET /api/queue/stats` - Get queue stats (Level 2+)
- `POST /api/queue/join` - Join call queue (Level 1)
- `GET /api/queue/my-status` - Check queue position (Level 1)
- `POST /api/queue/leave` - Leave call queue (Level 1)
- `POST /api/queue/:id/claim` - Claim a caller (Level 2+)
- `POST /api/queue/:id/start-call` - Start call with caller (Level 2+)
- `POST /api/queue/:id/complete` - Complete call with outcome (approved/denied), moves to Level 3 if approved
- `POST /api/queue/:id/release` - Release caller back to queue (Level 2+)
- `GET /api/agent/work-queue` - Get Level 3 work queue
- `GET /api/agent/work-queue/stats` - Get Level 3 queue stats
- `POST /api/agent/work-queue/:id/claim` - Level 3 claims application
- `POST /api/agent/work-queue/:id/complete` - Level 3 completes work, sends to Level 4
- `GET /api/admin/verification-queue` - Get Level 4 verification queue
- `GET /api/admin/verification-queue/stats` - Get Level 4 queue stats
- `POST /api/admin/verification-queue/:id/verify` - Level 4 verifies (approved/rework)
- `GET /api/commissions` - Get commissions (Level 3+)
- `GET /api/admin/users` - List all users (Level 4+)
- `PUT /api/admin/users/:id` - Update user (Level 4+)
- `GET /api/admin/applications` - List all applications (Level 4+)
- `PUT /api/owner/config` - Update site config (Level 5)

### Key Routes
- `/` - Landing page
- `/login`, `/register` - Authentication
- `/packages` - Service packages listing
- `/dashboard/applicant` - Applicant dashboard
- `/dashboard/applicant/applications/new` - New application wizard
- `/dashboard/applicant/call-queue` - Join call queue
- `/dashboard/reviewer` - Reviewer dashboard with queue
- `/dashboard/reviewer/call-queue` - Manage incoming calls
- `/dashboard/agent` - Agent dashboard
- `/dashboard/agent/queue` - Level 3 work queue
- `/dashboard/admin` - Admin dashboard
- `/dashboard/admin/users` - User management
- `/dashboard/owner` - Owner dashboard
- `/dashboard/owner/site-settings` - White-label configuration