/**
 * App.jsx — Root component
 *
 * This sets up:
 * 1. React Router with three pages
 * 2. A top navigation bar
 * 3. The main content area where pages render
 *
 * WHAT IS React Router?
 * React Router lets us show different "pages" without reloading the browser.
 * <BrowserRouter> wraps everything. <Routes> defines URL patterns.
 * <Route path="/..." element={<Component />} /> maps a URL to a component.
 * <Link> and <NavLink> create navigation links (no full page refresh).
 */

import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import CreateQuotePage from './pages/CreateQuotePage';
import SavedQuotesPage from './pages/SavedQuotesPage';
import QuoteReviewPage from './pages/QuoteReviewPage';
import './index.css';

// Helper: formats currency values consistently everywhere in the app
// $1200 → "$1,200.00"
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">

        {/* ── Top Navigation Bar ──────────────────────────── */}
        <nav className="navbar">
          <NavLink to="/" className="navbar-brand">
            Deal Desk <span>Quote Simulator</span>
          </NavLink>

          <ul className="navbar-links">
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) => isActive ? 'active' : ''}
              >
                Create Quote
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/quotes"
                className={({ isActive }) => isActive ? 'active' : ''}
              >
                Saved Quotes
              </NavLink>
            </li>
          </ul>
        </nav>

        {/* ── Page Content ────────────────────────────────── */}
        <main className="app-main">
          <Routes>
            {/* Page 1: Create a new quote */}
            <Route path="/" element={<CreateQuotePage />} />

            {/* Page 2: List all saved quotes */}
            <Route path="/quotes" element={<SavedQuotesPage />} />

            {/* Page 3: Review a single saved quote */}
            {/* :id is the MongoDB document ID from the URL */}
            <Route path="/quotes/:id" element={<QuoteReviewPage />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  );
}

export default App;
