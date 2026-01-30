# Application Portal - White-Label Multi-Role Platform

## Overview

This is a white-label application processing platform with a 5-tier user hierarchy system. The platform handles applications, document management, payments, messaging, and workflow automation. It's built as a full-stack TypeScript application with React frontend and Express backend, designed to be customizable for different business verticals (telemedicine, licensing, certification, etc.).

The core workflow follows: Registration → Package Selection → Payment → Document Upload → Review → Approval → Completion.

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

### User Hierarchy (5 Levels)
1. **Level 1 - Applicant**: End users who submit applications
2. **Level 2 - Reviewer**: Review submitted applications
3. **Level 3 - Agent**: Process documents and handle operations
4. **Level 4 - Admin**: Manage users, packages, and system settings
5. **Level 5 - Owner**: Full platform control, white-label configuration

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

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Vite builds to `dist/public`, esbuild bundles server to `dist/index.cjs`
- **Bundling Strategy**: Server dependencies in allowlist are bundled to reduce cold start times

## External Dependencies

### Database
- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- **Connection**: pg Pool with Drizzle ORM wrapper

### Frontend Libraries
- **UI Framework**: shadcn/ui (Radix UI + Tailwind)
- **Forms**: react-hook-form with @hookform/resolvers and Zod
- **Date Handling**: date-fns
- **Charts**: Recharts (via shadcn chart component)

### Backend Libraries
- **Authentication**: bcryptjs for password hashing
- **Sessions**: express-session with connect-pg-simple for PostgreSQL session store

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

### Call Queue System (Voice Consultation)
- **Level 1 (Applicant)**: Can join call queue, see position, leave queue
- **Level 2 (Reviewer)**: Pooled queue - any reviewer can claim callers, start calls, complete calls with outcomes
- **Flow**: Level 1 purchases package requiring Level 2 interaction → joins queue → Level 2 claims → call happens → Level 2 completes with notes
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
- `POST /api/queue/:id/complete` - Complete call with notes/outcome (Level 2+)
- `POST /api/queue/:id/release` - Release caller back to queue (Level 2+)
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
- `/dashboard/agent` - Agent dashboard with referrals
- `/dashboard/admin` - Admin dashboard
- `/dashboard/admin/users` - User management
- `/dashboard/owner` - Owner dashboard
- `/dashboard/owner/site-settings` - White-label configuration