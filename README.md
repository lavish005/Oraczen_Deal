# Deal Desk Quote Simulator

An internal tool for sales representatives to create, manage, and review customer quotations.

Built for Oraczen.AI as a take-home placement assignment.

---

## Project Overview

The Deal Desk Quote Simulator allows a sales representative to:

- Build a quote with customer details, seat count, and product selections
- Apply a discount and see the live pricing tier and total
- Understand whether the quote requires manager approval (and why)
- Save quotes to a database
- Review all saved quotes in a list
- Open a saved quote and progress it through a status workflow (Draft → Submitted → Approved/Rejected)

The application is an **internal sales tool**, not an analytics dashboard.

---

## Tech Stack

| Layer    | Technology           |
|----------|----------------------|
| Frontend | React (Vite) + JavaScript |
| Routing  | React Router DOM     |
| HTTP     | Axios                |
| Backend  | Node.js + Express.js |
| Database | MongoDB + Mongoose   |
| Testing  | Jest + Supertest     |

**Not used:** TypeScript, Python, Docker, Next.js, PostgreSQL, GraphQL, Prisma.

---

## Project Structure

```
Oraczen/
├── client/                      ← React frontend (Vite)
│   └── src/
│       ├── pages/
│       │   ├── CreateQuotePage.jsx   ← Page 1: Build a new quote
│       │   ├── SavedQuotesPage.jsx   ← Page 2: List saved quotes
│       │   └── QuoteReviewPage.jsx   ← Page 3: Review + status workflow
│       ├── App.jsx                   ← Root with routing + navbar
│       └── index.css                 ← All styles
│
└── server/                      ← Express backend
    ├── catalog.json             ← Source of truth for products + discount rules
    ├── index.js                 ← Server entry point (Express + MongoDB)
    ├── models/
    │   └── Quote.js             ← Mongoose schema for a saved quote
    ├── routes/
    │   ├── catalog.js           ← GET /api/catalog
    │   └── quotes.js            ← All /api/quotes routes
    ├── services/
    │   └── quoteCalculator.js   ← ALL business logic (tier, discount, totals, approval)
    └── tests/
        ├── quoteCalculator.test.js  ← Unit tests for business logic
        └── api.test.js              ← API integration tests (Supertest)
```

---

## Requirements

- **Node.js** v18 or higher
- **MongoDB** (local or MongoDB Atlas)
- **npm**

---

## Environment Variables

Create a file called `.env` inside the `server/` folder. You can copy `.env.example`:

```bash
cp server/.env.example server/.env
```

Then fill in your MongoDB URI:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/deal-desk
CLIENT_URL=http://localhost:5173
```

> **Do NOT commit your `.env` file.** It may contain database credentials.

---

## Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd Oraczen

# 2. Install backend dependencies
cd server
npm install

# 3. Install frontend dependencies
cd ../client
npm install
```

---

## Running the Application

You need three things running at the same time: MongoDB, the backend, and the frontend.

### 1. Start MongoDB

If you have MongoDB installed locally:

```bash
mongod
```

Or use [MongoDB Atlas](https://www.mongodb.com/atlas) (cloud) and put the connection string in your `.env` file.

### 2. Start the backend

```bash
cd server
npm run dev
```

The backend will start at: http://localhost:5000

You should see:
```
Connected to MongoDB successfully.
Server running on http://localhost:5000
```

### 3. Start the frontend

In a separate terminal:

```bash
cd client
npm run dev
```

The frontend will start at: http://localhost:5173

Open your browser to **http://localhost:5173** to use the application.

---

## API Documentation

All API endpoints are prefixed with `/api`.

### GET /api/catalog

Returns the full product catalog and discount rules.

**Response:**
```json
{
  "currency": "USD",
  "products": [
    { "sku": "AGENT-CORE", "name": "Agent Core", "unit_price": 120 },
    ...
  ],
  "discount_rules": [
    { "code": "STARTER", "min_seats": 1, "max_seats": 9, "max_discount_pct": 10 },
    ...
  ]
}
```

---

### POST /api/quotes/calculate

Calculates a quote preview without saving it.

**Request body:**
```json
{
  "customerName": "ABC Technologies",
  "seats": 50,
  "lines": [
    { "sku": "AGENT-CORE", "quantity": 50 },
    { "sku": "AGENT-ANALYTICS", "quantity": 50 }
  ],
  "discountPct": 20,
  "annualCommitment": true
}
```

**Response:**
```json
{
  "tier": "ENTERPRISE",
  "subtotal": 10000,
  "discountAmount": 2000,
  "total": 8000,
  "approvalRequired": true,
  "approvalReasons": [
    "discount_above_15_percent",
    "annual_commitment_discount_above_10_percent"
  ]
}
```

---

### POST /api/quotes

Saves a new quote to MongoDB. The backend recalculates all totals — it does NOT trust values from the frontend.

**Request:** Same body as `/calculate`.

**Response:** The saved quote document (including its MongoDB `_id`).

---

### GET /api/quotes

Returns all saved quotes (list view, sorted newest first).

---

### GET /api/quotes/:id

Returns a single saved quote with full detail.

---

### PATCH /api/quotes/:id/status

Updates the status of a saved quote.

**Request body:**
```json
{ "status": "submitted" }
```

The backend validates that the transition is allowed. Invalid transitions return a `400` error.

---

## Running Tests

```bash
cd server
npm test
```

This runs all files in the `tests/` folder using Jest. Tests include:
- Tier boundary tests (9 → STARTER, 10 → GROWTH, 49 → GROWTH, 50 → ENTERPRISE)
- Discount validation (STARTER + 11% → invalid)
- Approval logic (discount > 15%, total > $25,000, annual commitment + discount > 10%)
- API validation (unknown SKU → 400)
- Full quote calculation pipeline

---

## Business Rules Summary

### Pricing Tiers

| Seats   | Tier       | Max Discount |
|---------|------------|-------------|
| 1–9     | STARTER    | 10%         |
| 10–49   | GROWTH     | 20%         |
| 50+     | ENTERPRISE | 30%         |

### Discount Validation

The discount cannot exceed the tier maximum. This is enforced on the backend. The frontend shows an error from the server if the limit is exceeded.

### Approval Required When

- Discount > 15%
- Final total > $25,000
- Annual commitment is checked AND discount > 10%

Multiple rules can be triggered simultaneously; all reasons are returned.

### Status Workflow

```
draft → submitted → approved
                 → rejected
```

`approved` and `rejected` are terminal states. The backend validates all transitions.

---

## Design Decisions

See [DECISIONS.md](./DECISIONS.md) for full explanations of:
- Duplicate product merging
- 0% discount representation
- Money and rounding (cents-based arithmetic)
- Annual commitment and pricing
- Product snapshots in saved quotes
- Business rule location (backend authority)
- Allowed status transitions
