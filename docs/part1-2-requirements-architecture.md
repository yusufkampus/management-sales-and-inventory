# Cloud-Based Sales and Inventory Management System with Machine Learning Analytics for SMEs

**Document set:** Part 1 — Requirement Analysis · Part 2 — System Architecture
**Status:** Finalized (all open items resolved using architect-recommended defaults)
**Prepared as:** Final-year software engineering project documentation

---

# PART 1 — REQUIREMENT ANALYSIS (FINALIZED)

## 1.1 Project Overview

### Purpose
To design and implement a cloud-native, multi-tenant Sales and Inventory Management System for Small and Medium Enterprises (SMEs/UMKM), augmented with an explainable Machine Learning analytics module that forecasts stock depletion and product demand, enabling proactive restocking decisions instead of reactive ones.

### Background
SMEs typically manage inventory and sales manually or with disconnected spreadsheets, leading to stockouts, overstocking, and an inability to anticipate demand. Existing low-cost POS tools rarely include predictive analytics. This project addresses that gap with a layered, cloud-deployed architecture that separates transactional concerns (Express.js) from analytical/ML concerns (FastAPI), demonstrating both software architecture maturity and applied machine learning in a single production-style system.

### Objectives
- O1: Provide a role-based POS and inventory platform usable by multiple independent SME accounts (multi-tenant).
- O2: Guarantee transactional data integrity for sales and stock movements.
- O3: Provide explainable, statistically-grounded demand and stock-depletion forecasts (not black-box deep learning).
- O4: Demonstrate a cloud-native, horizontally decomposed architecture (separate frontend, API, and ML service deployments).
- O5: Produce documentation and diagrams sufficient to defend every design decision academically.

### Benefits
- For SME owners: earlier visibility into upcoming stockouts and a quantified restock suggestion.
- For cashiers: a simple, fast, role-constrained POS interface.
- For the institution: a reference implementation of layered architecture + PaaS deployment + applied ML integrated via REST, suitable for a final-year defense.

### Scope (In Scope)
- Multi-tenant authentication and RBAC (Admin, Cashier) via Supabase Auth.
- Product CRUD with image upload to Supabase Storage.
- Inventory stock movement logging (IN / OUT / ADJUSTMENT) and low-stock alerting.
- POS transaction creation with automatic, atomic stock deduction.
- Sales reporting (date-ranged, exportable in JSON via API).
- ML-based stock forecasting and demand prediction, on-demand, served by an independent FastAPI microservice.
- Deployment to Vercel (frontend), Railway (Express API service, FastAPI ML service).

### Out of Scope
Explicitly excluded to keep the system defensible and consistent — see §1.7.

---

## 1.2 Functional Requirements (FR)

| ID | Requirement |
|---|---|
| FR-01 | The system shall authenticate users via Supabase Auth (email/password) and issue a JWT session. |
| FR-02 | The system shall enforce two roles: `admin` and `cashier`, scoped to a single `store_id` per user. |
| FR-03 | Admin shall perform full CRUD on products, including image upload/replacement via Supabase Storage. |
| FR-04 | Cashier shall have read-only access to the product catalog. |
| FR-05 | Admin shall record stock movements (`IN`, `OUT`, `ADJUSTMENT`) with quantity, reason/note, and timestamp. |
| FR-06 | The system shall expose a low-stock alert when `stock_quantity <= min_stock_threshold` for a product. |
| FR-07 | Cashier (and Admin) shall create POS transactions consisting of one or more line items. |
| FR-08 | On transaction creation, the system shall atomically deduct sold quantities from `products.stock_quantity` and reject the transaction (HTTP 409) if any item's requested quantity exceeds available stock. |
| FR-09 | Each transaction line item shall snapshot the product's unit price at time of sale, independent of future price changes. |
| FR-10 | Admin shall generate sales reports filtered by date range, with totals, item counts, and per-product breakdown. |
| FR-11 | The system shall provide a stock-forecast prediction per product, indicating predicted depletion date and remaining days, computed by the ML service. |
| FR-12 | The system shall provide a demand prediction per product (estimated daily/weekly units), computed by the ML service. |
| FR-13 | The system shall provide a restock recommendation derived from current stock, predicted demand, and a configurable lead-time/safety-stock buffer. |
| FR-14 | The system shall provide an aggregated analytics/insights endpoint (top products, category performance, sales growth %) for the Admin dashboard. |
| FR-15 | All ML-dependent endpoints shall degrade gracefully to a naive-average fallback when insufficient historical data exists, returning `status: "insufficient_data"` instead of failing. |
| FR-16 | Express shall authenticate its server-to-server calls to the FastAPI ML service using a shared internal secret header. |

## 1.3 Non-Functional Requirements (NFR)

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | Standard CRUD endpoints shall respond within 300 ms (p95) under typical SME load (low hundreds of products/transactions per day). |
| NFR-02 | Performance | On-demand ML endpoints shall respond within 2–3 seconds (p95), acceptable since model fitting is in-memory and lightweight (linear regression / small random forest). |
| NFR-03 | Scalability | Each architectural layer (frontend, API, ML) shall scale and deploy independently, since they run as separate Railway/Vercel services. |
| NFR-04 | Security | All write/mutating endpoints shall require a valid JWT and pass role authorization middleware before reaching business logic. |
| NFR-05 | Security | Inter-service calls (Express → FastAPI) shall be authenticated and shall not be reachable directly by end clients. |
| NFR-06 | Availability | The system targets PaaS-managed availability (no custom HA orchestration); acceptable for an academic deployment tier. |
| NFR-07 | Maintainability | The codebase shall follow layered architecture with clear separation between routing, controllers, services, and data access. |
| NFR-08 | Data Integrity | Stock deduction on sale shall be enforced both at the application layer and via a database-level `CHECK` constraint to prevent race-condition negative stock. |
| NFR-09 | Portability | Configuration (Supabase keys, internal ML secret, JWT settings) shall be environment-variable driven, documented in `.env.example`. |
| NFR-10 | Explainability | All ML outputs shall be accompanied by the feature values and method used, so predictions are auditable rather than opaque. |

## 1.4 Locked Business Rules & Decisions

These were open items in the requirement-review stage; they are now treated as binding specification for every subsequent document (database, API, ML design).

**Tenancy & Business Scope**
- BR-01 Multi-tenant: every business-data table carries `store_id`; all queries are scoped by the authenticated user's store.
- BR-02 Single outlet per store account (no multi-branch stock).
- BR-03 Transactions = line items + unit price snapshot + total. No tax/discount engine in v1.
- BR-04 Transactions are immutable once created — no refunds/voids in v1 (documented as a future enhancement).

**Authorization**
- BR-05 RBAC is enforced primarily in Express middleware (role + store-scope checks) using the Supabase service-role key server-side; Supabase RLS is configured as a secondary defense-in-depth layer, not the primary gate.
- BR-06 Reports and ML/analytics endpoints are Admin-only. Cashier is restricted to POS + viewing their own shift/transaction history.
- BR-07 No public signup. Admin accounts are provisioned (seeded/invited); Admin creates Cashier accounts under their own `store_id`.

**Inventory**
- BR-08 Stock changes are recorded as an append-only `stock_movements` log (`type: IN | OUT | ADJUSTMENT`), which also serves as the ML training source — no Purchase Order/Supplier entity in v1.
- BR-09 One SKU = one product (no variants).
- BR-10 Checkout hard-blocks (HTTP 409) when requested quantity exceeds available stock; a DB `CHECK (stock_quantity >= 0)` is the race-condition backstop.
- BR-11 Low-stock threshold is per-product (`min_stock_threshold`), falling back to a store-level default if unset.

**Machine Learning — Data & Training**
- BR-12 Because thesis-stage data is sparse, a seed script generates 60–90 days of synthetic daily sales per product (weekday seasonality + trend) for demonstration; this is documented explicitly as a thesis-demo data strategy, not a production data pipeline.
- BR-13 A model is only considered "trained" with ≥14 days of sales history for that product; below that, the API returns a naive-average-based `insufficient_data` response instead of a regression result.
- BR-14 Models are trained on-demand, per request, using `scikit-learn`, with no persisted model binaries or registry — consistent with the "no batch processing" requirement. (Documented as the production-grade evolution path: nightly retraining + cached models.)
- BR-15 Demand Prediction uses **Random Forest Regressor** only when ≥30 historical data points exist for that product; otherwise it falls back to **Linear Regression**. Both branches are documented in the ML design with the selection rule explicit.
- BR-16 `day_of_week` is one-hot encoded (7 binary columns) rather than ordinal, since linear/tree models should not assume a false ordinal relationship between weekdays.

**ML Integration & Security**
- BR-17 FastAPI is stateless and credential-free: Express fetches sales history from Supabase and passes it in the FastAPI request body. FastAPI never queries the database directly.
- BR-18 Every Express → FastAPI call carries a shared secret in an `X-Internal-Service-Key` header, validated by FastAPI before processing.
- BR-19 ML predictions are not persisted in v1 (stateless, computed and returned only); an `ml_predictions` audit table is noted as a future enhancement.

**API & Data Conventions**
- BR-20 Standard response envelope: `{ success, message, data, errors }`.
- BR-21 Pagination via `page`/`limit` query params, default 20, max 100.
- BR-22 Soft delete for products (`is_active`), hard immutable records for transactions and stock movements.
- BR-23 All endpoints are versioned under `/api/v1`.

**Non-Functional / Deployment**
- BR-24 Expected scale: low hundreds of products and low hundreds of transactions/day per store — sized for on-demand ML latency to remain acceptable without batch jobs.
- BR-25 Express and FastAPI are deployed as **two independent Railway services** with separate URLs, independently deployable and scalable.
- BR-26 Single environment (production-only demo), with `.env.example` files documenting all required variables for reproducibility.

## 1.5 Assumptions
- A-01 The grading/demo environment has internet access to Vercel, Railway, and Supabase; no offline/PWA mode is required.
- A-02 UI is presented in Bahasa Indonesia for end users; code, comments, and documentation are in English.
- A-03 JWT/session lifecycle relies on Supabase Auth's native access/refresh token mechanism rather than a custom token service.
- A-04 Password policy uses Supabase Auth defaults (minimum length enforced by Supabase); no additional complexity rules are layered on top in v1.
- A-05 The synthetic seed data (BR-12) is clearly labeled as such in the database and is not presented as real business history.

## 1.6 Constraints
- C-01 No deep learning / neural network models are permitted — all ML must be explainable (linear regression, random forest, moving averages).
- C-02 The ML service must be reachable only through the Express backend, never directly by the React frontend.
- C-03 Hosting is limited to the specified PaaS providers (Vercel, Railway, Supabase) — no custom VM/Kubernetes orchestration.
- C-04 All persistent data lives in Supabase Postgres; FastAPI holds no persistent state of its own.

## 1.7 Out of Scope
- Multi-branch / multi-outlet inventory and stock transfers.
- Refunds, voids, partial returns.
- Tax and discount/promotion engines.
- Purchase Order / Supplier management.
- Product variants (size/color/SKU matrices).
- Deep learning, embeddings, or any non-explainable model class.
- Persisted/versioned ML model registry and scheduled retraining (noted as future work).
- Public self-registration of business accounts.
- Staging environment / CI gating beyond a single production deployment.

---

# PART 2 — SYSTEM ARCHITECTURE

## 2.1 Architectural Style & Rationale

The system uses a **Layered Architecture for the core transactional system** combined with a **single-purpose microservice for Machine Learning**. This hybrid is deliberate:

- A monolithic layered Express backend is appropriate for CRUD-heavy, transactional, RBAC-gated business logic (products, inventory, sales, reports) — it keeps deployment and debugging simple, which matters for a final-year project's maintainability and defensibility.
- The ML workload has a fundamentally different runtime profile (numerical computation, `scikit-learn`/`pandas`, Python ecosystem) than the rest of the system (Node.js, I/O-bound REST). Forcing it into Node.js would mean reimplementing regression algorithms or relying on weaker JS ML libraries. Isolating it as a FastAPI service lets each part use the best tool for its job and lets the two scale independently (NFR-03), which is also a cleaner story for "cloud computing principles" in an academic defense.
- The two services communicate over a well-defined REST contract (§2.6), keeping the ML service technology-agnostic from the frontend's perspective — the frontend never knows FastAPI exists.

## 2.2 Layer Breakdown

### 2.2.1 Presentation Layer — React (Vercel)
**Responsibility:** Render UI, manage client-side state/routing, call the Express API only (never FastAPI directly, per C-02), store the Supabase session JWT, attach it as a Bearer token on every request.
**Technology:** React.js, deployed as a static SPA build on Vercel's global CDN.
**Justification:** Vercel's PaaS model gives zero-config static hosting, automatic HTTPS, and CDN edge caching — ideal for a frontend with no server-side rendering requirement here.

### 2.2.2 Backend / API Layer — Express.js (Railway)
**Responsibility:** HTTP routing, request validation, JWT verification, RBAC enforcement, response shaping (BR-20 envelope), rate limiting, CORS, Helmet headers. This layer contains **no business logic** — it delegates to the Service Layer.
**Technology:** Express.js on Node.js.
**Justification:** Express is lightweight and explicit about middleware ordering, which makes the auth → role-check → validation → controller pipeline easy to diagram and easy to grade.

### 2.2.3 Business Logic / Service Layer (within the Express codebase)
**Responsibility:** Implements FR-03–FR-14's actual rules: stock deduction atomicity (FR-08), threshold checks (FR-06), report aggregation (FR-10), and orchestration of calls to the ML service (FR-11–FR-13). This layer is framework-agnostic — it does not know about `req`/`res`, only about domain objects — which keeps it unit-testable and is the conventional "service" tier in a layered architecture.
**Technology:** Plain Node.js modules/classes, called by controllers.
**Justification:** Separating this from the controller layer is what makes the architecture "layered" rather than a typical thin Express app with logic in route handlers — it is the single most defensible structural decision in this design and is referenced again in Part 8 (Code Structure).

### 2.2.4 Data Layer — Supabase (Postgres + Auth + Storage)
**Responsibility:** Durable storage of all tenant/business/transactional data, authentication/identity, and product image storage.
**Technology:** Supabase-managed Postgres, Supabase Auth (GoTrue), Supabase Storage (S3-compatible buckets).
**Justification:** Supabase bundles three otherwise-separate concerns (DB, auth, object storage) behind one managed PaaS surface with a generous free tier — appropriate for a final-year project's budget and timeline, while still being real production infrastructure (not a toy DB).

### 2.2.5 ML Layer — Python FastAPI (Railway, second service)
**Responsibility:** Feature engineering (`sales_7d_avg`, `sales_14d_avg`, `sales_trend`, one-hot `day_of_week`, `historical_sales`), on-demand model fitting (Linear Regression / Random Forest per BR-15), and returning forecast/demand/restock outputs with their supporting feature values (NFR-10).
**Technology:** FastAPI, `scikit-learn`, `pandas`, `numpy`.
**Justification:** FastAPI's typed request/response models (Pydantic) make the ML contract self-documenting and easy to validate — important since this service receives raw sales-history JSON from Express and must reject malformed input defensively, given C-04 (no DB access of its own to fall back on).

### 2.2.6 Cross-Cutting Concerns
Logging, error handling, environment configuration, and security headers (Helmet, CORS, rate limiting) span all layers and are detailed in Part 7 (Security) of this documentation set.

## 2.3 High-Level Architecture (Overview Diagram)

A formal UML Component and Deployment diagram (Mermaid + draw.io XML) is produced in Part 4 and Part 7. The textual overview below anchors that later detail:

```
┌─────────────────────────┐
│   React SPA (Vercel)    │   Presentation Layer
└───────────┬──────────────┘
            │ HTTPS + JWT (Bearer)
            ▼
┌─────────────────────────────────────────────┐
│ Express.js API (Railway Service #1)         │
│ ┌───────────────────────────────────────┐   │
│ │ Middleware: Helmet, CORS, RateLimit,   │   │
│ │ JWT Verify, RBAC, Validation           │   │
│ ├───────────────────────────────────────┤   │
│ │ Controllers (HTTP <-> domain mapping)  │   │
│ ├───────────────────────────────────────┤   │
│ │ Service Layer (business rules,         │   │
│ │ stock atomicity, report aggregation)   │   │
│ ├───────────────────────────────────────┤   │
│ │ Data Access Layer (Supabase client)    │   │
│ └───────────────────────────────────────┘   │
└──────────┬───────────────────────┬───────────┘
           │                       │ HTTPS + Internal Secret
           ▼                       ▼
┌───────────────────────┐  ┌──────────────────────────────┐
│ Supabase               │  │ FastAPI ML Service            │
│ - Postgres (data)      │  │ (Railway Service #2)          │
│ - Auth (JWT issuer)     │  │ - Feature engineering         │
│ - Storage (images)      │  │ - Linear Regression /         │
└───────────────────────┘  │   Random Forest (on-demand)   │
                            └──────────────────────────────┘
```

## 2.4 Cloud Architecture Design

### Why PaaS (over IaaS/self-managed)
A final-year project has no operations team and a short timeline. PaaS providers (Vercel, Railway, Supabase) remove server provisioning, OS patching, and scaling configuration, letting the project's effort go into application and ML design rather than infrastructure plumbing — while still being genuinely cloud-native (managed scaling, HTTPS, environment isolation), which satisfies the "cloud computing principles" requirement.

### Why Supabase
Supabase provides Postgres (relational integrity needed for stock/transaction consistency — see NFR-08), Auth (JWT issuance, removing the need to build password hashing/session logic from scratch), and Storage (for product images) as one coherent managed service with a single project dashboard, instead of integrating three separate vendors.

### Why Railway
Railway supports deploying **two independent services** from one project (Express API + FastAPI ML service) with separate URLs, independent environment variables, and independent scaling — directly matching BR-25 and the requirement that Express and FastAPI be loosely coupled, replaceable services rather than one monolith.

### Why Vercel
Vercel is purpose-built for static/SPA frontend hosting with automatic CDN distribution and zero-config HTTPS, and integrates with GitHub for automatic redeploys on push — minimizing frontend deployment ceremony.

### Request Flow (client read/write request)
1. React app attaches the Supabase-issued JWT as `Authorization: Bearer <token>` on the API call.
2. Request hits Express on Railway; Helmet/CORS/rate-limit middleware run first.
3. JWT verification middleware validates the token (against Supabase's JWKS/secret) and extracts `user_id`, `store_id`, `role`.
4. RBAC middleware checks the route's required role against the token's role; rejects with 403 if mismatched.
5. Input validation middleware checks the request body/params/query against schema.
6. Controller delegates to the Service Layer, which applies business rules and calls the Data Access Layer.
7. Data Access Layer calls Supabase Postgres (via the service-role key, scoped manually by `store_id` in every query per BR-05).
8. Response is shaped into the standard envelope (BR-20) and returned.

### Deployment Flow
1. Frontend repository push → Vercel build triggers → static bundle deployed to CDN.
2. Backend repository push → Railway build triggers for the Express service → new container deployed, environment variables injected from Railway's project settings.
3. ML repository (or subfolder) push → Railway build triggers for the FastAPI service independently → new container deployed with its own environment variables (including the shared `INTERNAL_ML_SECRET`).
4. No deployment of one service requires redeploying another — satisfying NFR-03.

### Security (architecture-level summary; full detail in Part 7)
- JWT-based authentication at the API boundary; no session state stored in Express.
- RBAC enforced server-side, never trusted from client claims alone.
- FastAPI is not publicly callable in practice from the frontend (C-02) and additionally requires the internal shared-secret header (BR-18) even if its URL were discovered.
- Supabase service-role key lives only in Express's server-side environment, never shipped to the frontend.

### Scalability
- Stateless Express containers can be horizontally scaled by Railway without session-affinity concerns (JWT is self-contained).
- The FastAPI service is independently scalable from the Express service, important because ML requests are CPU-bound (model fitting) while API requests are I/O-bound (DB calls) — they have different scaling triggers.
- Supabase Postgres scaling is managed by the provider; the schema (Part 3) is designed with appropriate indexes to keep query cost low at the project's expected scale (BR-24).

### Availability
Each layer relies on its PaaS provider's managed availability (Vercel's CDN, Railway's container restarts, Supabase's managed Postgres uptime). No custom multi-region failover is implemented or claimed — this is explicitly scoped as appropriate for an academic deployment (NFR-06), not a claim of enterprise SLA.

## 2.5 API Gateway / Request Flow Notes
There is no separate API Gateway product in this architecture (e.g., no Kong/AWS API Gateway) — Express itself acts as the single entry point and "gateway" for all client traffic, performing the cross-cutting concerns (auth, rate limiting, CORS) that a dedicated gateway would otherwise handle. This is an explicit simplification appropriate to the project's scale, noted here so it is not mistaken for an oversight: introducing a separate gateway product would add operational complexity without a corresponding benefit at this traffic volume (BR-24).

## 2.6 ML Service Integration Flow

This is the flow referenced by FR-11–FR-13, BR-17, and BR-18, and is formalized as a UML Sequence Diagram in Part 4.

1. Admin requests a forecast (e.g., `GET /api/v1/ml/predict-stock/:productId`) through the React dashboard.
2. Express verifies JWT + Admin role (per BR-06).
3. The Service Layer queries Supabase for that product's `stock_movements` history (scoped by `store_id`).
4. The Service Layer checks the row count: if `< 14` days of data, it short-circuits and returns a naive-average-based `insufficient_data` response directly (BR-13) — **no call to FastAPI is made** in this case, saving latency and keeping the contract honest about confidence.
5. If sufficient data exists, Express packages the sales history as JSON and calls the FastAPI service (`POST /predict-stock`) with the `X-Internal-Service-Key` header (BR-18).
6. FastAPI performs feature engineering (7d/14d moving averages, trend, one-hot weekday) and fits the appropriate model in-memory (BR-15's selection rule), then returns the prediction plus the feature values used (NFR-10).
7. Express maps the FastAPI response into the standard API envelope (BR-20) and returns it to the React client.
8. The React dashboard renders the predicted depletion date, remaining days, and restock recommendation.

This flow keeps FastAPI completely stateless and ignorant of authentication/tenancy — it only ever sees the data Express chooses to send it, which is the architectural enforcement of C-02 and BR-17.

---

**End of Part 1 & Part 2.**

Next: **Part 3 — Database Design** (ERD, normalization, full table/column/constraint/index specification consistent with every business rule above) and **Relationship Schema**.

Reply "continue" to proceed.
