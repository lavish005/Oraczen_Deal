import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import CreateQuotePage from './pages/CreateQuotePage';
import SavedQuotesPage from './pages/SavedQuotesPage';
import QuoteReviewPage from './pages/QuoteReviewPage';
import './index.css';

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

        <main className="app-main">
          <Routes>
            <Route path="/" element={<CreateQuotePage />} />

            <Route path="/quotes" element={<SavedQuotesPage />} />

            <Route path="/quotes/:id" element={<QuoteReviewPage />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  );
}

export default App;
