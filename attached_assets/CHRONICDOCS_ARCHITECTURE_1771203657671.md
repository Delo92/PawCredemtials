# ChronicDocs — Architecture & Implementation Reference

## Overview

ChronicDocs is a telemedicine platform for medical cannabis recommendations, managing the entire workflow from patient registration and video consultations to automated PDF form filling and document submission. It supports multiple user roles (patients, doctors, agents, administrators, business owners, and support staff) with tailored interfaces, aiming to streamline the process while ensuring regulatory compliance. The platform also includes a comprehensive blog system and dynamic, SEO-optimized landing pages for patient acquisition and engagement across US states.

---

## System Architecture

### System Design and Data Handling
- **Data Storage**: Firebase/Firestore for persistent data, utilizing Firebase UIDs as primary keys, with Firestore transactions for atomic operations.
- **Workflow Tracking**: A dual-write pattern with Firebase as the source of truth and `stepData` for audit trails. Consistent workflow: Payment → Doctor Approval → Agent Upload → Admin Approval, with state-specific variations.
- **Real-Time Status**: Redis tracks doctor and agent online/offline status.
- **Agent Referral System**: Supports referral URLs, automated cleanup, and tracking for commissions and exclusivity.
- **Error Logging**: Comprehensive system with log points, severity levels, and deduplication.
- **Queue Management**: Atomic 15-minute queue timeout for video consultations and real-time agent queue updates via Firestore listeners.
- **Patient Management**: Server-side search, filtering, consistent profile UI, commission approval pagination, and robust deduplication.
- **Workflow Synchronization**: `PatientProfileSyncService` ensures bidirectional synchronization between step data, queue entries, and form assignments; `users.progressPercentage` is synced with `applicationStatus.currentStep`.

### Frontend
- **Frameworks**: React with TypeScript and Vite.
- **UI/Styling**: shadcn/ui (Radix UI), Material-UI, and Tailwind CSS.
- **State Management**: TanStack Query.
- **Routing**: React Router DOM with role-based protected routes.
- **Real-time Communication**: WebSockets for video features.

### Backend
- **Runtime**: Node.js with Express.js (TypeScript, ES modules).
- **Database ORM**: Drizzle with PostgreSQL dialect.
- **Authentication**: Firebase Authentication with Passport.js for session management.
- **API**: RESTful endpoints with role-based access control.

### Authentication & Authorization
- **Strategy**: Firebase Authentication using email/password via custom claims.
- **User Levels**: Hierarchical role-based access control — 1=patient, 2=doctor, 3=agent, 4=admin, 5=owner. Support users have admin-level access for certain features but are restricted from owner-specific ones.
- **Shared Support Inbox**: All support staff share a single inbox for patient replies.
- **Access Control**: Middleware-based route protection.

---

## Key Features

### PDF Processing
- Flask-based Python microservice for PDF generation.

### Video Consultation
- Custom WebSocket server with WebRTC.

### Automation
- Direct SendGrid email automation triggered by workflow steps, with configurable templates.

### Communication History
- Tracks all automated and manual communications.

### Admin Tools
- Manual step unlocking with audit trails, workflow isolation repair, diagnostic components, and patient workflow reset capabilities.

### Email Audit Trail
- Tabbed interface for reviewing automated system emails sent to patients.

### Call Log System
- Comprehensive call tracking (inbound, outbound, voicemail) with deduplication, transcription, and audio playback.

### Patient Messaging
- Patients can view conversation threads and attach files.

### Bulk In-App Messaging
- Agents can send templated in-app messages to Doctor Approved patients, with patient confirmation leading to agent notification.

### Auto-Send Direct Messages
- Package-level `autoMessageTriggers` (step2-step5) automatically send in-app Gizmo messages at workflow step completion, mirroring `autoResponseTriggers` for emails.

### Gizmo AI Auto-Reply
- Powered by Google Gemini (`gemini-2.5-flash` via `@google/genai` SDK).
- When a patient sends a message, the system auto-generates and sends an intelligent reply using patient context (workflow step, package, state, conversation history).
- Uses `system_gizmo` sender UID, `gizmo_ai` messageType, dual-write to Messages + PatientCommunications, and WebSocket real-time delivery.
- Service: `server/services/gizmo-ai.ts`.
- Agent endpoint: `POST /api/messages/gizmo-ai/generate` (agent+ only, authorization-checked).

### Gizmo AI Configuration
- Owner-editable prompt configuration stored in Firestore (`systemSettings/gizmoAiConfig`).
- Supports custom system prompt, Q&A pairs, avoid topics, max word count, and fallback message.
- Server loads config dynamically from Firestore on each generation, falling back to hardcoded defaults.
- Managed via Owner Dashboard.
- Endpoints: `GET/PUT /api/admin/gizmo-ai-config` (owner-only).

### Gizmo Chat Widget
- Floating AI chat popup on all pages.
- Uses `generateGizmoWidgetResponse()` in `server/services/gizmo-ai.ts`.
- Supports logged-in users (with patient context: name, step, package, state) and anonymous visitors.
- Rate limited to 5 messages/hour per session; on the 5th response appends contact-support redirect; after 5th returns redirect-only.
- Endpoint: `POST /api/messages/gizmo-widget/chat` (public, optional auth).
- Frontend: `client/src/components/shared/GizmoChat.tsx`, mounted globally in `App.tsx`.

### Email Unsubscribe System
- HMAC-based one-time token system.

### Homepage Video Embeds
- Owner-configurable, sanitized YouTube/Vimeo embeds with advanced styling.

### Blog Feature
- Robust blog system with draft/publish workflow, SEO metadata, and dynamic sitemap/RSS feed generation.

### State Welcome Landing Pages
- Dynamically generated, SEO-optimized landing pages for all US states.

### City Landing Pages
- City-specific landing pages with local SEO optimization.

### Condition Pages
- Qualifying condition pages with structured data and strain recommendations.

### Pricing Page
- Dynamic pricing page displaying state-specific pricing from Firebase.

### Testimonials Page
- Curated patient reviews with live Google Reviews widget integration.

### Terms of Service
- Role-specific terms with version history.

### Gizmo Form System
- Browser-only PDF form filling with pre-filled patient data, agent correction capabilities, and HIPAA compliance (no server-side storage).
- Supports multiple form layouts and doctor-specific offsets.

### Doctor Document Uploads
- Doctors can upload images/documents to patient profiles, stored in Firebase Cloud Storage, with viewing and deletion capabilities.

### SEO Enhancements
- Comprehensive meta tags and JSON-LD schemas across the platform.

---

## Doctor Sticky Notes

- **Overview**: Owner-managed notes containing doctor information (name, address, license numbers, DEA, NPI, phone, fax, notes) stored in Firestore (`doctorStickyNotes` collection). Displayed as a collapsible panel within GizmoFormInline when forms are opened, with copy-to-clipboard buttons for each field.
- **Management**: Owner/admin can create and edit sticky notes per doctor from the Doctors tab in the Owner Dashboard.
- **Endpoints**: `GET/PUT/DELETE /api/admin/doctor-sticky-notes/:doctorUid` (owner/admin write, all staff read).

---

## Doctor-Only Auto-Complete System

- **Overview**: For specific packages, the system automatically generates and emails filled PDFs to patients after doctor approval, bypassing agent and admin steps.
- **Architecture**: Activated by a package-level toggle (`doctorOnlyAutoComplete`), triggered by workflow automation, using a server-side PDF generator (`pdf-lib`), an in-memory queue for concurrency control (MAX_CONCURRENCY=10, MAX_RETRIES=1), SendGrid for email, and comprehensive audit logging to Firestore `gizmoAutoCompleteLogs` collection.

---

## External Dependencies

### Core Infrastructure
- **Database**: Neon Database (PostgreSQL-compatible serverless).
- **Payment Processing**: Authorize.Net (with Accept.js).
- **Email Service**: SendGrid.
- **File Storage**: Firebase Cloud Storage.
- **Generative AI**: Google Gemini via `@google/genai` SDK with `gemini-2.5-flash` model (`GOOGLE_GEMINI_API_KEY`).

### PDF & Document Services
- **PDF Libraries**: PyPDF2, ReportLab, pdf-lib (browser-side and server-side auto-complete), pdfjs-dist (PDF rendering).

### UI & Styling
- **Component Libraries**: Radix UI (via shadcn/ui).
- **Icons**: Lucide React.
- **Charts**: Recharts.
- **Styling Framework**: Tailwind CSS.

### Analytics & Monitoring
- **Web Analytics**: Google Analytics 4.
- **Error Logging**: Centralized error tracking service with Firestore storage.

### CRM & Marketing Automation
- **GoHighLevel**: CRM platform for one-way data sync (contacts, custom fields, notes, commissions) and real-time payout ledger. No longer used for email delivery. GHL tag syncing DISABLED to prevent GHL automation emails from firing — all email automation is handled by SendGrid directly.

---

## Implementation Details & Internal Patterns

### Key File Locations
| File | Purpose |
|------|---------|
| `server/services/workflow-automation.ts` | Orchestrates step completions (progress tracking, email via SendGrid, in-app messaging, GHL CRM sync, auto-complete triggers) |
| `server/services/gizmo-ai.ts` | Google Gemini integration with configurable prompts, live data enrichment, patient context, conversation history, 3-hour staff follow-up timer, and rate-limited retry logic |
| `server/services/pdf-queue.ts` | In-memory queue for doctor-only auto-complete; generates PDF → saves to Firebase Storage → emails via SendGrid → marks Steps 4+5 complete |
| `server/services/pdf-auto-generator.ts` | Server-side PDF generation using pdf-lib |
| `client/src/pages/GizmoForm.tsx` | Browser-side PDF form filling with dual-mode detection (AcroForm vs Placeholder), radio button auto-fill, doctor-specific coordinate offsets, and Doctor Sticky Notes panel |
| `client/src/components/shared/GizmoChat.tsx` | Floating AI chat popup mounted globally in App.tsx |
| `server/routes/messages.ts` | Message endpoints including Gizmo AI generate, widget chat, and chat log viewing |
| `server/routes/admin.ts` | Doctor Sticky Notes CRUD, Gizmo AI config, and other admin endpoints |
| `client/src/components/admin/PatientList.tsx` | Admin patient management with search, filtering, and inactive patient view |
| `server/firebase-storage.ts` | Firestore data access layer (FirestoreStorage class) |
| `server/routes.ts` | Main route file including Gizmo form data endpoint and PDF download |

### Design Patterns & Conventions
- **API Calls**: All frontend API calls use `apiRequest` helper from `@/lib/queryClient` for auth, retries, and content-type handling.
- **User Levels**: Numeric hierarchy — 1=patient, 2=doctor, 3=agent, 4=admin, 5=owner.
- **Dual-Write Pattern**: Messages are written to both Messages collection and PatientCommunications collection for audit trails.
- **Gizmo System UID**: `system_gizmo` is the sender UID for all automated Gizmo messages (auto-replies, auto-messages, follow-ups).
- **Message Types**: `gizmo_ai` for AI auto-replies, `bulk_gizmo` for auto-send step messages.
- **Live Data Caching**: Gizmo AI caches Firestore live data (packages, states, conditions) for 10 minutes (CACHE_TTL).
- **WebSocket Delivery**: Gizmo auto-replies and follow-ups attempt real-time WebSocket delivery after Firestore write.

### Workflow Automation Flow (`handleStepCompletion`)
1. Update `applicationStatus.currentStep` and progress percentage.
2. On Step 3 completion: check for `doctorOnlyAutoComplete` packages → enqueue Gizmo PDF generation (2s delay).
3. Determine email script: Step 1 uses global setting, Steps 2-5 use per-package `autoResponseTriggers`.
4. Send email via SendGrid (direct, not through GHL).
5. Check `autoMessageTriggers` (step2-step5) → send in-app direct messages using `messageScripts` collection templates with personalization (`{firstName}`, `{lastName}`, `{packageName}`, `{patientUID}`).
6. Non-blocking GoHighLevel CRM sync for contact data.

### Auto-Complete Pipeline
1. Step 3 completes (doctor approval) → `handleStepCompletion` detects `doctorOnlyAutoComplete` package.
2. `enqueueGizmoAutoComplete()` adds to in-memory queue with deduplication.
3. `processItem()`: generates PDF → saves to Firebase Storage → emails patient via SendGrid → marks Steps 4+5 complete → triggers Step 5 automation (with `skipEmail` flag to avoid duplicate emails).
4. Audit logged to Firestore `gizmoAutoCompleteLogs` collection.

### Gizmo Form System Details
- **Form Detection**: Loads PDF via proxy (`/api/forms/proxy-pdf`), detects AcroForm fields first; if none found, falls back to placeholder text overlay mode.
- **Field Mapping**: `FIELD_NAME_MAP` maps PDF field names to patient/doctor/meta data keys; `PLACEHOLDER_MAP` maps `{placeholder}` text to data sources.
- **Radio Auto-Fill**: `RADIO_AUTO_FILL` maps radio groups (idtype, licensetype) to patient data values.
- **Doctor Sticky Notes**: Fetched per doctor UID, displayed as collapsible panel with copy-to-clipboard for each field (name, address, license, DEA, NPI, phone, fax, notes).
- **Form Data Endpoint**: `GET /api/forms/gizmo-form-data/:patientUid` — looks up patient, package, approving doctor (from queue or approvals), doctor-specific PDF URL from `doctorForms` array in package config.
- **Doctor-Specific Offsets**: Hardcoded coordinate offsets per doctor last name (e.g., Fore: x+3/y-4, Foshee: x+0/y-3) for precise text placement in placeholder mode.

### Gizmo AI Details
- **Gemini Model**: `gemini-2.5-flash` via `@google/genai` SDK.
- **Retry Logic**: Up to 2 retries on rate limit (429/RESOURCE_EXHAUSTED), with dynamic wait time parsed from error message or incremental 15s/30s backoff.
- **System Prompt**: Default ~80-line prompt defining Gizmo persona (playful dog mascot), core rules, workflow context, common Q&A, and tone examples. Augmented with owner-configurable Q&A pairs, avoid topics, and max word count from Firestore.
- **Live Data Enrichment**: Loads packages (names, prices, states), available states, state configs (urgent messages), services, conditions, patient count, and bulletin from Firestore. Cached 10 minutes.
- **Patient Context**: Fetches patient name, state, current step, package name, and workflow status from Firestore for personalized responses.
- **Conversation History**: Loads last 8-10 messages from patient chat history for context continuity.
- **3-Hour Follow-Up**: `scheduleStaffFollowUp()` sets a timer; if staff hasn't replied within 3 hours, Gizmo sends a follow-up message to the patient and notifies via WebSocket.
- **Enable/Disable**: Owner can toggle Gizmo AI on/off via `systemSettings/gizmoAi` Firestore document.

### Patient Search
- Single-word search queries search both `firstName` AND `lastName` fields (previously only firstName).
- Inactive patient filter routes through backend with proper Firestore query.
- Inactive patients display `inactivatedAt` timestamp (not `createdAt`).
- Firestore Timestamps serialized to ISO strings in backend responses.
- Patients are only marked inactive through manual admin/owner action — no automatic process.
