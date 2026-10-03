/**
 * QuoteReviewPage.jsx — Page 3: Review a single saved quote
 *
 * What this page does:
 * 1. Reads the quote :id from the URL (e.g. /quotes/abc123)
 * 2. Calls GET /api/quotes/:id to load the full quote from MongoDB
 * 3. Displays all quote details: customer, seats, tier, products, totals, approval
 * 4. Shows the current status and available status transition buttons
 * 5. When a status button is clicked, calls PATCH /api/quotes/:id/status
 *
 * STATUS TRANSITIONS (enforced by the backend):
 *   draft      → can Submit (→ submitted)
 *   submitted  → can Approve (→ approved) or Reject (→ rejected)
 *   approved   → no transitions available (terminal state)
 *   rejected   → no transitions available (terminal state)
 *
 * STATE:
 * - quote: the full quote object from the backend
 * - loading: true while fetching
 * - error: error message if fetch or status update fails
 * - statusUpdating: true while PATCH request is in progress
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency } from '../App';

const API = 'http://localhost:5000/api';

// Human-readable labels for approval reason codes
const REASON_LABELS = {
  discount_above_15_percent: 'Discount is above 15%',
  total_above_25000: 'Total exceeds $25,000',
  annual_commitment_discount_above_10_percent: 'Annual commitment with discount above 10%',
};

export default function QuoteReviewPage() {
  // useParams reads URL parameters. If the URL is /quotes/abc123, then params.id = "abc123"
  const { id } = useParams();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [statusSuccess, setStatusSuccess] = useState(null);

  // Load the quote when the page mounts (or when the id changes)
  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/quotes/${id}`)
      .then(res => {
        setQuote(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Quote not found. It may have been deleted, or the backend is not running.');
        setLoading(false);
      });
  }, [id]);

  // ── Status Transition ─────────────────────────────────────
  async function handleStatusChange(newStatus) {
    setStatusError(null);
    setStatusSuccess(null);
    setStatusUpdating(true);

    try {
      const response = await axios.patch(`${API}/quotes/${id}/status`, {
        status: newStatus,
      });
      // Update the quote in state with the new version returned by the server
      setQuote(response.data);
      setStatusSuccess(`Status updated to "${newStatus}" successfully.`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update status.';
      setStatusError(msg);
    } finally {
      setStatusUpdating(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────

  if (loading) return <div className="loading">Loading quote...</div>;

  if (error) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Quote Review</h1>
        </div>
        <div className="alert alert-error">{error}</div>
        <Link to="/quotes" className="btn btn-secondary">← Back to Saved Quotes</Link>
      </div>
    );
  }

  const { customerName, seats, lines, discountPct, annualCommitment, calculation, status, createdAt } = quote;

  // Build the list of available next status transitions for the current status
  // These mirror the backend ALLOWED_TRANSITIONS object
  const transitions = {
    draft:     [{ label: 'Submit for Approval', value: 'submitted', style: 'btn-primary' }],
    submitted: [
      { label: 'Approve', value: 'approved', style: 'btn-success' },
      { label: 'Reject',  value: 'rejected', style: 'btn-danger' },
    ],
    approved: [], // no further transitions
    rejected: [], // no further transitions
  };
  const availableTransitions = transitions[status] || [];

  return (
    <div>
      {/* Back link + page header */}
      <div className="page-header">
        <Link
          to="/quotes"
          className="text-muted"
          style={{ fontSize: '0.83rem', textDecoration: 'none', display: 'inline-block', marginBottom: '8px' }}
        >
          ← Back to Saved Quotes
        </Link>
        <div className="flex justify-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Quote Review</h1>
            <p className="page-subtitle">
              {customerName} · Created {new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <span className={`status-badge status-${status}`} style={{ fontSize: '0.85rem', padding: '4px 14px' }}>
            {status}
          </span>
        </div>
      </div>

      {/* Two-column layout: details left, actions right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>

        {/* ── LEFT: Quote Details ──────────────────────── */}
        <div>

          {/* Customer & Seat info */}
          <div className="card mb-4">
            <h2 className="card-title">Customer Information</h2>
            <div className="detail-row">
              <span className="detail-key">Customer Name</span>
              <span className="detail-value">{customerName}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Number of Seats</span>
              <span className="detail-value">{seats}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Pricing Tier</span>
              <span className={`tier-badge tier-${calculation.tier}`}>{calculation.tier}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Annual Commitment</span>
              <span className="detail-value">{annualCommitment ? 'Yes' : 'No'}</span>
            </div>
          </div>

          {/* Product lines */}
          <div className="card mb-4">
            <h2 className="card-title">Products</h2>
            {lines.map(line => (
              <div key={line.sku} className="product-line-detail">
                <div className="product-line-left">
                  <p className="product-line-name">{line.productName}</p>
                  <p className="product-line-calc">
                    {line.quantity} × {formatCurrency(line.unitPrice)}
                  </p>
                </div>
                <span className="product-line-total">{formatCurrency(line.lineTotal)}</span>
              </div>
            ))}
          </div>

          {/* Pricing summary */}
          <div className="card mb-4">
            <h2 className="card-title">Pricing Summary</h2>
            <div className="detail-row">
              <span className="detail-key">Subtotal</span>
              <span className="detail-value money">{formatCurrency(calculation.subtotal)}</span>
            </div>
            {discountPct > 0 && (
              <div className="detail-row">
                <span className="detail-key">Discount ({discountPct}%)</span>
                <span className="detail-value text-success money">
                  −{formatCurrency(calculation.discountAmount)}
                </span>
              </div>
            )}
            <div className="detail-row" style={{ borderTop: '2px solid var(--color-border)', marginTop: '4px', paddingTop: '10px' }}>
              <span className="detail-key fw-bold" style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>
                Final Total
              </span>
              <span className="detail-total">{formatCurrency(calculation.total)}</span>
            </div>
          </div>

          {/* Approval section */}
          <div className="card">
            <h2 className="card-title">Approval</h2>
            <div className={`approval-banner ${calculation.approvalRequired ? 'approval-required' : 'approval-not-required'}`}>
              <strong>
                {calculation.approvalRequired ? '⚠ Approval Required' : '✓ No Approval Required'}
              </strong>
              {calculation.approvalRequired && calculation.approvalReasons.length > 0 && (
                <ul className="approval-reasons">
                  {calculation.approvalReasons.map(reason => (
                    <li key={reason}>{REASON_LABELS[reason] || reason}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Status Actions ────────────────────── */}
        <div>
          <div className="card">
            <h2 className="card-title">Status Workflow</h2>

            {/* Current status display */}
            <div style={{ marginBottom: '16px' }}>
              <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '6px' }}>
                Current Status
              </p>
              <span className={`status-badge status-${status}`} style={{ fontSize: '0.85rem', padding: '4px 14px' }}>
                {status}
              </span>
            </div>

            {/* Status flow diagram (simple text) */}
            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '16px', lineHeight: '1.8' }}>
              <span style={{ color: status === 'draft' ? 'var(--color-text)' : undefined, fontWeight: status === 'draft' ? 700 : undefined }}>Draft</span>
              {' → '}
              <span style={{ color: status === 'submitted' ? 'var(--color-text)' : undefined, fontWeight: status === 'submitted' ? 700 : undefined }}>Submitted</span>
              {' → '}
              <span style={{ color: status === 'approved' ? 'var(--color-success)' : undefined, fontWeight: status === 'approved' ? 700 : undefined }}>Approved</span>
              <br />
              <span style={{ paddingLeft: '72px' }}>
                {'→ '}
                <span style={{ color: status === 'rejected' ? 'var(--color-danger)' : undefined, fontWeight: status === 'rejected' ? 700 : undefined }}>Rejected</span>
              </span>
            </div>

            {/* Status feedback messages */}
            {statusSuccess && (
              <div className="alert alert-success" style={{ marginBottom: '12px' }}>
                {statusSuccess}
              </div>
            )}
            {statusError && (
              <div className="alert alert-error" style={{ marginBottom: '12px' }}>
                {statusError}
              </div>
            )}

            {/* Action buttons for available transitions */}
            {availableTransitions.length > 0 ? (
              <div className="status-actions" style={{ flexDirection: 'column' }}>
                {availableTransitions.map(t => (
                  <button
                    key={t.value}
                    className={`btn ${t.style}`}
                    onClick={() => handleStatusChange(t.value)}
                    disabled={statusUpdating}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {statusUpdating ? 'Updating...' : t.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted" style={{ fontSize: '0.83rem' }}>
                {status === 'approved'
                  ? 'This quote has been approved. No further changes are allowed.'
                  : 'This quote has been rejected. No further changes are allowed.'}
              </p>
            )}
          </div>

          {/* Quick summary card */}
          <div className="card mt-4">
            <h2 className="card-title">Quick Summary</h2>
            <div className="detail-row">
              <span className="detail-key">Seats</span>
              <span className="detail-value">{seats}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Tier</span>
              <span className={`tier-badge tier-${calculation.tier}`}>{calculation.tier}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Discount</span>
              <span className="detail-value">{discountPct}%</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Total</span>
              <span className="detail-value money" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
                {formatCurrency(calculation.total)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Approval</span>
              <span className={`detail-value ${calculation.approvalRequired ? 'text-danger' : 'text-success'}`}>
                {calculation.approvalRequired ? 'Required' : 'Not Required'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
