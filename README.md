# Tripvahan 🚗✨

> **India's Premier Commercial Outstation & Circuit Group Transport Marketplace**

Tripvahan connects group travellers with verified commercial fleet operators for outstation journeys, pilgrimage circuits, and multi-day tours. Engineered with enterprise-grade security, zero-trust caller authentication, and PostgreSQL atomic transaction guarantees.

---

## 🏗️ Architecture & Technology Stack

- **Frontend & API:** [Next.js 15 App Router](https://nextjs.org/) (React 19, TypeScript)
- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL 15+, Row-Level Security, Database Triggers, and Stored Procedures)
- **Styling:** Tailwind CSS with Lucide React iconography
- **State & Concurrency:** Database-level mutex locking, snapshot isolation, and strict state-machine transitions

---

## 🔒 Security & Data Integrity Guarantees

Tripvahan enforces rigorous security invariants across all API routes and database interactions:

1. **Zero-Trust Caller Authentication:**
   - All privileged operations (`/api/bookings`, `/api/quotations`, `/api/vehicles`, `/api/admin/operators`, `/api/operator/documents`) mandate verified Bearer token authentication via Supabase Auth.
   - Caller identities (`p_caller_id`, `operator_id`) are derived strictly from the verified user session (`supabase.auth.getUser()`). Client-supplied IDs in request bodies are never trusted as proof of identity.

2. **Cross-Tenant Authorization Guards:**
   - Travellers can only book, view, and cancel their own trips and bookings.
   - Fleet operators can only submit quotations and manage vehicles linked to their verified operator ID.
   - Unverified operator accounts are strictly prohibited from bidding on passenger circuits until approved by platform administrators.

3. **Atomic Database Transactions (No Insecure Direct-Write Fallbacks):**
   - **Booking Confirmation:** Executed via `public.confirm_booking_transaction(...)` which atomically verifies traveler ownership, locks the selected quotation, rejects competing bids, validates vehicle availability, and creates the booking record.
   - **Booking Cancellation:** Executed via `public.cancel_booking_transaction(...)` ensuring policy compliance and partial unique constraint preservation.
   - **Operator Verification:** Executed via `public.verify_operator_transaction(...)` ensuring operator profile updates, fleet compliance adjustments, and persistent audit logs succeed or fail together atomically.
   - **Document Review:** Executed via `public.review_operator_document_transaction(...)` with mandatory reviewer attribution and audit trail.

4. **Multi-Day Concurrency & Vehicle Overlap Prevention:**
   - PostgreSQL partial unique indexes and interval overlap triggers prevent overlapping reservations for the same commercial vehicle across active bookings.

5. **Trigger Invariants & Audit Immutability:**
   - Database triggers enforce immutability on financial amounts, booking codes, vehicle registration numbers, and traveller IDs once records are committed.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** `>= 20.0.0`
- **npm:** `>= 10.0.0`
- **Supabase Account** with PostgreSQL database instance

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/itzdevilsunny/tripvahan.git
   cd tripvahan
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase configuration:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-anon-key
   SUPABASE_SECRET_KEY=your-supabase-service-role-secret-key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 🧪 Testing & Verification Suites

Tripvahan includes comprehensive automated testing covering unit logic, database triggers, and end-to-end marketplace workflows:

### 1. Unit Test Suite (43 tests)
Runs isolated business logic, capacity validation, state machine rules, and negative security barrier checks:
```bash
npm test
```

### 2. TypeScript Validation
Ensures strict type safety with zero compiler errors:
```bash
npx tsc --noEmit
```

### 3. Production Build Validation
Verifies bundle optimization and static generation:
```bash
npm run build
```

### 4. Staging PostgreSQL Triggers & RLS (12 tests)
Runs live against the staging Supabase database to verify trigger invariants, foreign key constraints, RLS policies, and stored procedure atomicity:
```bash
npm run test:staging
```

### 5. End-to-End Marketplace Lifecycle (11 steps)
Tests the complete multi-tenant lifecycle against a running local instance (Traveller trip creation → Operator registration & quotation → Admin verification → Booking confirmation → Concurrency guard → Cancellation):
```bash
# Start server on port 3002
npm run start -- -p 3002

# Run E2E test suite
npm run test:e2e
```

---

## 📂 Project Structure

```
tripvahan/
├── app/
│   ├── api/
│   │   ├── admin/operators/    # Admin verification & audit log endpoint
│   │   ├── bookings/           # Booking confirmation, cancellation, & mutations
│   │   ├── operator/documents/ # Statutory compliance documents & reviews
│   │   ├── quotations/         # Itemized operator bid submissions
│   │   ├── trips/              # Traveller outstation trip requests
│   │   └── vehicles/           # Commercial fleet vehicle registration
│   ├── layout.tsx              # Root Next.js layout & providers
│   └── page.tsx                # Marketplace main interface
├── components/                 # Reusable UI components & modals
├── lib/
│   ├── supabaseServer.ts       # Centralized server-side Supabase client
│   └── types.ts                # TypeScript domain models & DTOs
├── scripts/
│   ├── test-marketplace.js     # Unit test suite (43 tests)
│   ├── test-staging-integration.js  # Staging DB triggers & RLS suite
│   └── test-e2e-marketplace-lifecycle.js # Authenticated E2E lifecycle suite
├── supabase/
│   └── migrations/             # Production & staging SQL migrations
└── public/                     # Static assets & icons
```

---

## 📜 License

Private & Proprietary — Tripvahan Mobility Solutions. All rights reserved.