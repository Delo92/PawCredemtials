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
- **Application Workflow**: A multi-step wizard for creating applications, with a profile completeness gate.
- **Doctor Review System**: Secure, token-based review links for doctors, supporting round-robin assignment.
- **Automated Document Generation**: Certificates are auto-generated upon doctor approval, incorporating doctor credentials.
- **Auto-Message Triggers**: Automated notifications based on application status changes.
- **Owner Configuration**: Comprehensive white-label settings for branding and site content.
- **Admin Management**: Tools for user and application management, including manual payment processing.
- **Gizmo Form System**: Browser-side PDF auto-fill using `pdf-lib` and `pdfjs-dist` for both AcroForm and placeholder PDFs, with PDF template upload and management.
- **Application Processing**: Automated workflow from applicant submission to doctor review (or auto-completion based on settings) and final certification, with comprehensive email integrations via SendGrid.

### API Endpoints
Key endpoints exist for authentication, user profiles, site configuration, package management, application submission, doctor review processes, admin and owner functionalities, and form data handling.

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