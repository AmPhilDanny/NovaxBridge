# Novaxbridge — SkillBridge Africa

A full-stack digital skills marketplace and learning platform connecting African talent with opportunities. Includes a public marketplace, online academy with AI tutoring, B2B hiring tools, job board, project collaboration, and more.

## Architecture

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Novaxbridge    │    │  admin_Novax     │    │   External       │
│  (Port 3000)     │    │  (Port 4000)     │    │   Services       │
│  Frontend (Vite) │    │  Admin Panel     │    │   (Jitsi,        │
│  → Vercel        │    │  → Vercel        │    │   OpenRouter,    │
└────────┬─────────┘    └────────┬─────────┘    │   Supabase)      │
         │                       │              └──────────────────┘
         └───────────┬───────────┘
                     │
          ┌──────────▼──────────┐
          │   server (Port 4001) │
          │   Express API        │
          │   → Render           │
          │                      │
          │  ┌────────────────┐  │
          │  │   Redis        │  │
          │  │   (BullMQ)     │  │
          │  └────────────────┘  │
          │  ┌────────────────┐  │
          │  │   Supabase     │  │
          │  │  (PostgreSQL)  │  │
          │  └────────────────┘  │
          └──────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS, Radix UI, Framer Motion |
| **Admin** | React 19, Vite, TypeScript, Tailwind CSS, Radix UI |
| **Backend** | Express, TypeScript, Zod, Pino, Socket.IO |
| **Database** | Supabase (PostgreSQL with Row Level Security) |
| **Auth** | Supabase Auth (email/password, OAuth) |
| **Real-time** | Socket.IO (messaging, notifications) |
| **AI** | OpenRouter / Mistral (AI Tutor) |
| **Video** | Jitsi Meet (video rooms) |
| **Payments** | Flutterwave / Paystack via iceberg-js |
| **Job Queue** | BullMQ + Redis |
| **Deployment** | Vercel (frontends), Render (API) |

## Features

### Marketplace
- Browse and search service listings by category
- Create and manage listings (services/products)
- Order management with payment flow
- Dispute resolution system
- Wallet for transactions

### Academy (Online Learning)
- Browse course catalog with search and filters
- Enroll in free or paid courses
- Lesson player with video, text, live sessions, quizzes, and assignments
- Module/lesson builder with drag-and-drop reorder
- Progress tracking and completion certificates
- Tutor application and management system

### AI Tutor
- AI-powered tutoring sessions using OpenRouter/Mistral
- Knowledge base integration (add course content as context)
- Quiz generation and grading
- In-lesson AI tutor ("Ask AI Tutor about this lesson")

### Jobs Board
- Browse and search job listings
- Post jobs (firm/organization role)
- Apply with application tracking

### Talent Discovery
- Talent directory with profile search
- Skill and project portfolio display
- Direct messaging

### Projects
- Create and showcase projects
- Collaboration tools
- Applications to join projects

### B2B Platform
- Organization setup and management
- Document verification workflow
- Team management
- Talent pool curation
- Hiring pipeline with video interviews
- Contracts and compliance tracking
- Analytics dashboard

### Messaging
- Direct user-to-user messaging
- Real-time via Socket.IO
- Unread notification bell

### Video Calls
- Jitsi-powered video rooms
- Room-based sessions linked to courses and meetings
- No account required for participants

### Wallet & Payments
- Wallet balance management
- Transaction history
- Flutterwave/Paystack integration

### Admin Panel
- Platform-wide stats and metrics
- Marketplace listing moderation
- Academy management (courses, tutors, enrollments)
- User management with role assignment
- AI provider configuration (API keys, models)
- Manual payment verification
- B2B billing management
- Site configuration (branding, hero, nav, footer, SEO)
- CMS pages editor (Tiptap rich text)

## Project Structure

```
├── Novaxbridge/              # Main frontend application
│   ├── src/
│   │   ├── assets/           # Static assets (images, icons)
│   │   ├── b2b/              # B2B platform components and pages
│   │   ├── components/       # Shared UI components (shadcn/ui)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── integrations/     # Supabase client
│   │   ├── lib/              # Utility functions, API client
│   │   ├── pages/            # Route pages
│   │   └── types/            # TypeScript type definitions
│   ├── package.json
│   ├── vite.config.ts
│   └── vercel.json
│
├── admin_Novaxbridge/        # Admin dashboard
│   ├── src/
│   │   ├── components/       # Admin UI components
│   │   ├── hooks/            # Auth and permissions hooks
│   │   ├── lib/              # API client and utilities
│   │   └── pages/            # Admin pages (tabs)
│   ├── package.json
│   └── vercel.json
│
├── server/                   # Backend API
│   ├── src/
│   │   ├── routes/           # API route handlers
│   │   │   ├── academy/      # Course CRUD, enrollments, certificates
│   │   │   ├── admin/        # Site configuration
│   │   │   ├── ai/           # AI provider management
│   │   │   ├── b2b/          # Organizations, hiring, contracts
│   │   │   ├── email/        # Email sending
│   │   │   ├── github/       # GitHub OAuth integration
│   │   │   ├── jobs/         # Jobs and applications
│   │   │   ├── marketplace/  # Listings, orders
│   │   │   ├── messaging/    # Conversations, messages
│   │   │   ├── notifications/# Notification CRUD
│   │   │   ├── payments/     # Payment processing
│   │   │   ├── projects/     # Project collaboration
│   │   │   ├── video-call/   # Video room management
│   │   │   ├── wallet/       # Wallet and transactions
│   │   │   └── webhooks/     # External service webhooks
│   │   ├── middleware/        # Auth, validation, error handling
│   │   ├── lib/              # Supabase admin, helpers
│   │   ├── types/            # Shared type definitions
│   │   ├── sockets/          # Socket.IO event handlers
│   │   └── media/            # Media processing
│   ├── worker/               # BullMQ background job worker
│   └── package.json
│
├── supabase/                 # Supabase migrations and seed data
├── .gitignore
├── render.yaml               # Render deployment config
└── DEPLOY.md                 # Deployment guide
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Supabase project (free tier works)
- Redis instance (for BullMQ job queue)

### 1. Clone and Install

```bash
git clone https://github.com/AmPhilDanny/NovaxBridge.git
cd NovaxBridge

# Install server dependencies
cd server && npm install && cd ..

# Install frontend dependencies
cd Novaxbridge && npm install && cd ..

# Install admin dependencies
cd admin_Novaxbridge && npm install && cd ..
```

### 2. Environment Variables

Create `.env` files in each workspace:

**server/.env**
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
REDIS_URL=your_redis_url
PORT=4001
```

**Novaxbridge/.env**
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:4001/api
```

**admin_Novaxbridge/.env**
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:4001/api
VITE_MAIN_SITE_URL=http://localhost:3000
```

### 3. Run Locally

```bash
# Terminal 1 — Start the API server
cd server
npm run dev

# Terminal 2 — Start the frontend
cd Novaxbridge
npm run dev

# Terminal 3 — Start the admin panel
cd admin_Novaxbridge
npm run dev
```

- Frontend: http://localhost:3000
- Admin: http://localhost:4000
- API: http://localhost:4001

### 4. Test Accounts

| Role         | Email                     | Password     |
|-------------|---------------------------|-------------|
| Admin        | admin@skillbridge.africa  | Admin@123456 |
| Student      | sarah.j@example.com       | User@123456  |
| Organization | hr@techvista.io           | Org@123456   |

## Deployment

See [DEPLOY.md](./DEPLOY.md) for full deployment instructions.

| Service   | Platform | Target URL                          |
|-----------|----------|-------------------------------------|
| Frontend  | Vercel   | `dala-studuo.vercel.app`            |
| Admin     | Vercel   | (separate deployment)               |
| API       | Render   | `dalastudioshowcase.onrender.com`   |
| Database  | Supabase | (cloud-hosted)                      |

## API Overview

All API routes are prefixed with `/api`. Key route groups:

| Group        | Base Path          | Description                     |
|-------------|--------------------|---------------------------------|
| Academy     | `/api/academy/`    | Courses, enrollments, tutoring  |
| Admin       | `/api/admin/`      | Site configuration              |
| AI          | `/api/ai/`         | AI provider and model settings  |
| B2B         | `/api/b2b/`        | Organizations, hiring, contracts|
| GitHub      | `/api/github/`     | GitHub OAuth integration        |
| Jobs        | `/api/jobs/`       | Job listings and applications   |
| Marketplace | `/api/marketplace/`| Listings and orders             |
| Messaging   | `/api/messaging/`  | Conversations and messages      |
| Payments    | `/api/payments/`   | Flutterwave/Paystack processing |
| Projects    | `/api/projects/`   | Project collaboration           |
| Video Call  | `/api/video-call/` | Video room management           |
| Wallet      | `/api/wallet/`     | Wallet and transactions         |

## Security

- Row Level Security (RLS) on all Supabase tables
- Helmet middleware for HTTP security headers
- JWT-based authentication middleware
- Input validation with Zod
- CSP (Content Security Policy) configured
- SQL injection prevention via parameterized queries
- Encrypted storage for sensitive tokens (GitHub OAuth)

A full security audit report is available at [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md).

## License

Private project. All rights reserved.
