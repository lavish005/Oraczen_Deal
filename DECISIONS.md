# DECISIONS.md — Design Decisions for Deal Desk Quote Simulator

This document answers every design question from the assignment brief and explains the reasoning behind each decision.

---

## 1. What happens if the same product is added twice?

**Decision: Quantities are merged into a single line.**

If the user adds "Agent Core × 5" and then adds "Agent Core × 10", the backend combines them into "Agent Core × 15" before calculating.

This is implemented in `server/services/quoteCalculator.js` in the `mergeLines()` function. It uses a JavaScript object as a map: SKU → total quantity. After looping through all lines, it converts the map back into an array.

**Why merge instead of rejecting duplicates?**
Merging is more user-friendly. In a real sales tool, a rep might add the same product accidentally or intentionally (e.g., in separate steps). Merging silently gives the correct result. Rejecting would create friction without adding business value.

The frontend also reflects this: if the same SKU is submitted twice, the backend will merge them before displaying in the preview.

---

## 2. Is 0% discount represented as 0 or omitted?

**Decision: Always stored and returned as `discountPct: 0`.**

A 0% discount is explicitly represented. It is never `null`, `undefined`, or omitted.

**Why?**
- Omitting it would make the data ambiguous: "Is there no discount, or was the discount forgotten?"
- Treating 0 as a valid explicit value makes the code simpler. There is no need for null-checks — every quote has a `discountPct`.
- It also clearly conveys intent in the saved quote: "The salesperson chose 0% discount."

This applies to both the API response and the MongoDB document.

---

## 3. How do you handle money and rounding?

**Decision: All calculations are done in integer cents. Dollar values are only used for display.**

**The problem with floating-point JavaScript:**
```javascript
0.1 + 0.2 === 0.30000000000004   // true — this is a real JavaScript bug
```

If we calculated with dollars directly, small rounding errors could accumulate across many line items.

**Our solution:**
- `$120.00` is stored internally as `12000 cents`
- All multiplication and addition is done with integers (no decimals possible)
- `Math.round()` is used when dividing (for percentage calculations) to handle any edge cases
- Results are divided by 100 before being returned or stored

```javascript
// Example: 20% discount on $10,000
const subtotalCents = 1000000;           // $10,000 = 1,000,000 cents
const discountCents = Math.round(1000000 * 20 / 100);  // = 200000 cents
const totalCents = 1000000 - 200000;     // = 800000 cents
const total = 800000 / 100;              // = $8,000
```

**Why not use a money library?**
Libraries like `dinero.js` add complexity and are unnecessary for this catalog. All catalog prices are round dollar amounts (no fractions of cents), so the cents approach is sufficient and beginner-friendly.

---

## 4. Does annual commitment change pricing?

**Decision: No — annual commitment does NOT change the product price or the final total.**

Annual commitment only affects the **approval logic**.

When `annualCommitment: true` AND `discountPct > 10%`, the quote requires approval.

**Why is this the design?**
The assignment brief is explicit: "Annual Commitment does NOT change the product price. It only affects the approval logic." This is documented in the code as a comment on the `annualCommitment` field in `Quote.js`.

In a real tool, annual commitment might unlock a different price schedule, but that is not part of this assignment's scope.

---

## 5. What happens if a product disappears from the catalog after a quote is saved?

**Decision: A "snapshot" of each product's details is saved inside the quote document.**

When a quote is saved to MongoDB, we store the product's `sku`, `name`, `unitPrice`, `quantity`, and `lineTotal` directly in the `lines` array of the quote document. These values come from the catalog at the time of saving.

**Why?**
If we only stored the SKU and looked up the price from `catalog.json` when displaying an old quote, a change to the catalog would silently break or alter the old quote. A quote is a legal/business document — it must reflect the price that was agreed upon, not today's price.

**For new quotes:** If a SKU is not in the current catalog, the backend throws an error (`Unknown product SKU: XYZ`). Old quotes are unaffected.

---

## 6. Where do business rules live?

**Decision: All business rules live on the backend in `server/services/quoteCalculator.js`. The frontend is only for display.**

This includes:
- Finding the pricing tier from seat count
- Validating that the discount does not exceed the tier maximum
- Calculating line totals, subtotals, discount amounts, and final totals
- Determining whether approval is required and why

**Why?**
A user can bypass any React form by sending a raw HTTP request with Postman or `curl`. If we only validated in React, the API would be insecure and the data in MongoDB could be wrong.

The frontend calls `/api/quotes/calculate` to get the preview — it does not calculate anything itself. The backend recalculates everything independently when saving a quote.

---

## 7. Which status transitions are allowed?

The following transitions are permitted:

| From       | To         | Allowed? |
|------------|------------|----------|
| `draft`    | `submitted`| ✅ Yes   |
| `submitted`| `approved` | ✅ Yes   |
| `submitted`| `rejected` | ✅ Yes   |
| `draft`    | `approved` | ❌ No    |
| `draft`    | `rejected` | ❌ No    |
| `approved` | anything   | ❌ No    |
| `rejected` | anything   | ❌ No    |

`approved` and `rejected` are **terminal states** — once a quote reaches them, no further changes are allowed.

This is enforced in `server/routes/quotes.js` in the `ALLOWED_TRANSITIONS` object. If an invalid transition is requested, the backend returns:
```json
{ "error": "Cannot change status from approved to submitted." }
```

---

## What I Noticed

1. **The assignment says the company cares about TypeScript/Python quality** — since I am using JavaScript/MERN instead of their preferred stack, I focused on writing clean, readable JavaScript with detailed comments to compensate and demonstrate the same level of care.

2. **Catalog data has no fractional cent prices** — all unit prices are round dollar amounts ($120, $80, $150, $2500). This makes the cents-based math approach especially clean.

3. **The ONBOARDING product ($2,500) is a flat fee** — it is not seat-based like the other products, but the current catalog treats it the same way (quantity × price). In a real tool, you might want a different pricing model for one-time fees.

4. **The `calculate` endpoint is called before `save`** — this means every quote preview involves an API call. A debounce (400ms delay) prevents excessive requests while the user is typing.

5. **The status transition model is strict** — this is intentional. Allowing a rejected quote to be re-submitted, for example, could create audit issues in a real sales workflow.

---

## What I Would Do With Another Day

1. **Add a `.env` setup to the client** — currently the backend URL (`http://localhost:5000`) is hardcoded in the React pages. With more time, I would use Vite's `import.meta.env` to make it configurable.

2. **Add pagination to `GET /api/quotes`** — if there are thousands of quotes, loading them all at once would be slow. I would add `page` and `limit` query parameters.

3. **Add quote search and filtering** — filter by customer name, status, or date range on the saved quotes page.

4. **Use localStorage for draft recovery** — save the form state to `localStorage` so refreshing the page doesn't lose an unsaved quote.

5. **Add a dedicated test MongoDB database** — currently the API tests can affect the real database. With more time, I would use `mongodb-memory-server` to run a temporary in-memory MongoDB during tests.

6. **Better error boundaries in React** — wrap pages with React error boundaries to catch unexpected render errors and show a friendly message.

7. **Add quote editing** — allow opening a saved draft quote and modifying it.
