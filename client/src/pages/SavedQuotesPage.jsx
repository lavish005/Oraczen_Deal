import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency } from '../App';

const API = 'http://localhost:5000/api';

export default function SavedQuotesPage() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/quotes`)
      .then(res => {
        setQuotes(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load saved quotes. Is the backend running?');
        setLoading(false);
      });
  }, []);

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  if (loading) {
    return <div className="loading">Loading saved quotes...</div>;
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Saved Quotes</h1>
        </div>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header flex justify-between" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Saved Quotes</h1>
          <p className="page-subtitle">{quotes.length} quote{quotes.length !== 1 ? 's' : ''} found</p>
        </div>
        <Link to="/" className="btn btn-primary">
          + New Quote
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p>No quotes have been saved yet.</p>
            <Link to="/" className="btn btn-primary">Create your first quote</Link>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="quotes-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Seats</th>
                <th>Tier</th>
                <th>Total</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map(quote => (
                <tr key={quote._id}>
                  <td style={{ fontWeight: 600 }}>{quote.customerName}</td>
                  <td>{quote.seats}</td>
                  <td>
                    <span className={`tier-badge tier-${quote.calculation?.tier}`}>
                      {quote.calculation?.tier || '—'}
                    </span>
                  </td>
                  <td className="money" style={{ fontWeight: 600 }}>
                    {quote.calculation?.total != null
                      ? formatCurrency(quote.calculation.total)
                      : '—'}
                  </td>
                  <td>
                    <span className={`status-badge status-${quote.status}`}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="text-muted" style={{ fontSize: '0.83rem' }}>
                    {quote.createdAt ? formatDate(quote.createdAt) : '—'}
                  </td>
                  <td>
                    <Link
                      to={`/quotes/${quote._id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
