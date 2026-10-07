import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency } from '../App';

const API = 'http://localhost:5000/api';

const REASON_LABELS = {
  discount_above_15_percent: 'Discount is above 15%',
  total_above_25000: 'Total exceeds $25,000',
  annual_commitment_discount_above_10_percent: 'Annual commitment with discount above 10%',
};

export default function CreateQuotePage() {
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const [form, setForm] = useState({
    customerName: '',
    seats: '',
    lines: [{ sku: '', quantity: 1 }],
    discountPct: 0,
    annualCommitment: false,
  });

  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchCatalog() {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await axios.get(`${API}/catalog`);
          if (!cancelled) setCatalog(res.data);
          return;
        } catch {
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
          } else {
            if (!cancelled) setCatalogError('Could not load product catalog. Is the backend running?');
          }
        }
      }
    }
    fetchCatalog();
    return () => { cancelled = true; };
  }, [retryCount]);

  const updatePreview = useCallback(async (currentForm) => {
    const { customerName, seats, lines, discountPct, annualCommitment } = currentForm;

    const hasValidLines = lines.some(l => l.sku && l.quantity > 0);
    const hasSeats = seats !== '' && Number(seats) > 0;

    if (!hasValidLines || !hasSeats) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    const validLines = lines.filter(l => l.sku && l.quantity > 0);

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const response = await axios.post(`${API}/quotes/calculate`, {
        customerName: customerName || 'Preview',
        seats: Number(seats),
        lines: validLines.map(l => ({ sku: l.sku, quantity: Number(l.quantity) })),
        discountPct: Number(discountPct),
        annualCommitment: Boolean(annualCommitment),
      });
      setPreview(response.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not calculate preview.';
      setPreviewError(msg);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      updatePreview(form);
    }, 400);

    return () => clearTimeout(timer);
  }, [form, updatePreview]);

  function handleFieldChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  }

  function handleLineChange(index, field, value) {
    setForm(prev => {
      const newLines = [...prev.lines];
      newLines[index] = { ...newLines[index], [field]: value };
      return { ...prev, lines: newLines };
    });
  }

  function handleAddLine() {
    setForm(prev => ({
      ...prev,
      lines: [...prev.lines, { sku: '', quantity: 1 }],
    }));
  }

  function handleRemoveLine(index) {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  }

  function validateForm() {
    const newErrors = {};

    if (!form.customerName.trim()) {
      newErrors.customerName = 'Customer name is required.';
    }

    const seatsNum = Number(form.seats);
    if (!form.seats || !Number.isInteger(seatsNum) || seatsNum <= 0) {
      newErrors.seats = 'Seats must be a positive whole number.';
    }

    const validLines = form.lines.filter(l => l.sku);
    if (validLines.length === 0) {
      newErrors.lines = 'At least one product must be selected.';
    }

    const discountNum = Number(form.discountPct);
    if (isNaN(discountNum) || discountNum < 0) {
      newErrors.discountPct = 'Discount must be 0 or greater.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    setSaveError(null);

    if (!validateForm()) return;

    const validLines = form.lines.filter(l => l.sku && l.quantity > 0);

    setSaving(true);
    try {
      await axios.post(`${API}/quotes`, {
        customerName: form.customerName.trim(),
        seats: Number(form.seats),
        lines: validLines.map(l => ({ sku: l.sku, quantity: Number(l.quantity) })),
        discountPct: Number(form.discountPct),
        annualCommitment: form.annualCommitment,
      });

      navigate('/quotes');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save quote. Please try again.';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (catalogError) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Create Quote</h1>
        </div>
        <div className="alert alert-error">{catalogError}</div>
        <button
          className="btn btn-secondary"
          style={{ marginTop: '12px' }}
          onClick={() => { setCatalogError(null); setCatalog(null); setRetryCount(c => c + 1); }}
        >
          ↺ Retry
        </button>
      </div>
    );
  }

  if (!catalog) {
    return <div className="loading">Loading catalog...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Create Quote</h1>
        <p className="page-subtitle">Fill in the details below to build a new customer quote.</p>
      </div>

      <div className="builder-layout">

        <div>

          <div className="card mb-4">
            <h2 className="card-title">Customer Information</h2>

            <div className="form-group">
              <label className="form-label" htmlFor="customerName">Customer Name</label>
              <input
                id="customerName"
                type="text"
                className={`form-input ${errors.customerName ? 'error' : ''}`}
                placeholder="e.g. ABC Technologies"
                value={form.customerName}
                onChange={e => handleFieldChange('customerName', e.target.value)}
              />
              {errors.customerName && (
                <p className="form-error">{errors.customerName}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="seats">Number of Seats</label>
              <input
                id="seats"
                type="number"
                className={`form-input ${errors.seats ? 'error' : ''}`}
                placeholder="e.g. 50"
                min="1"
                step="1"
                value={form.seats}
                onChange={e => handleFieldChange('seats', e.target.value)}
                style={{ maxWidth: '180px' }}
              />
              {errors.seats && <p className="form-error">{errors.seats}</p>}
              <p className="form-hint">
                1–9 = Starter (10% max) · 10–49 = Growth (20% max) · 50+ = Enterprise (30% max)
              </p>
            </div>
          </div>

          <div className="card mb-4">
            <h2 className="card-title">Products</h2>

            {errors.lines && <div className="alert alert-error">{errors.lines}</div>}

            <table className="product-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Line Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, index) => {
                  const selectedProduct = line.sku
                    ? catalog.products.find(p => p.sku === line.sku)
                    : null;
                  const lineTotal = selectedProduct
                    ? selectedProduct.unit_price * Number(line.quantity)
                    : 0;

                  return (
                    <tr key={index}>
                      <td>
                        <select
                          value={line.sku}
                          onChange={e => handleLineChange(index, 'sku', e.target.value)}
                          style={{ minWidth: '180px' }}
                        >
                          <option value="">— Select product —</option>
                          {catalog.products.map(p => (
                            <option key={p.sku} value={p.sku}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantity}
                          onChange={e => handleLineChange(index, 'quantity', Number(e.target.value))}
                          style={{ width: '70px' }}
                        />
                      </td>
                      <td className="text-muted money">
                        {selectedProduct ? formatCurrency(selectedProduct.unit_price) : '—'}
                      </td>
                      <td className="line-total">
                        {line.sku && line.quantity > 0 ? formatCurrency(lineTotal) : '—'}
                      </td>
                      <td>
                        {form.lines.length > 1 && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRemoveLine(index)}
                            type="button"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <button
              className="btn btn-secondary"
              onClick={handleAddLine}
              type="button"
            >
              + Add Product
            </button>
          </div>

          <div className="card mb-4">
            <h2 className="card-title">Pricing Options</h2>

            <div className="form-group">
              <label className="form-label" htmlFor="discountPct">Discount (%)</label>
              <input
                id="discountPct"
                type="number"
                className={`form-input ${errors.discountPct ? 'error' : ''}`}
                min="0"
                max="100"
                step="1"
                value={form.discountPct}
                onChange={e => handleFieldChange('discountPct', e.target.value)}
                style={{ maxWidth: '120px' }}
              />
              {errors.discountPct && <p className="form-error">{errors.discountPct}</p>}
              <p className="form-hint">
                Enter 0 for no discount. The maximum allowed depends on the seat count tier.
              </p>
            </div>

            <div className="checkbox-group">
              <input
                id="annualCommitment"
                type="checkbox"
                checked={form.annualCommitment}
                onChange={e => handleFieldChange('annualCommitment', e.target.checked)}
              />
              <label htmlFor="annualCommitment">Annual Commitment</label>
            </div>
            <p className="form-hint" style={{ marginTop: '-12px' }}>
              Annual commitment does not change pricing — it affects approval requirements only.
            </p>
          </div>

          {saveError && <div className="alert alert-error">{saveError}</div>}
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            id="save-quote-btn"
          >
            {saving ? 'Saving...' : 'Save Quote'}
          </button>
        </div>

        <div>
          <div className="quote-preview">
            <p className="quote-preview-title">Live Quote Preview</p>

            {previewLoading && (
              <p className="text-muted" style={{ fontSize: '0.83rem' }}>Calculating...</p>
            )}

            {previewError && !previewLoading && (
              <div className="alert alert-error" style={{ fontSize: '0.82rem' }}>
                {previewError}
              </div>
            )}

            {!preview && !previewLoading && !previewError && (
              <p className="text-muted" style={{ fontSize: '0.83rem' }}>
                Add seats and at least one product to see the preview.
              </p>
            )}

            {preview && !previewLoading && (
              <>
                <div className="preview-row">
                  <span className="preview-label">Pricing Tier</span>
                  <span className={`tier-badge tier-${preview.tier}`}>{preview.tier}</span>
                </div>

                <div style={{ margin: '10px 0', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                  Products
                </div>
                {preview.lines.map(line => (
                  <div key={line.sku} style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.83rem', fontWeight: 500 }}>
                        {line.productName}
                      </span>
                      <span className="money" style={{ fontSize: '0.83rem' }}>
                        {formatCurrency(line.lineTotal)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                      {line.quantity} × {formatCurrency(line.unitPrice)}
                    </div>
                  </div>
                ))}

                <hr style={{ border: 'none', borderTop: '1px dashed var(--color-border)', margin: '10px 0' }} />

                <div className="preview-row">
                  <span className="preview-label">Subtotal</span>
                  <span className="preview-value">{formatCurrency(preview.subtotal)}</span>
                </div>

                {Number(form.discountPct) > 0 && (
                  <div className="preview-row">
                    <span className="preview-label">Discount ({form.discountPct}%)</span>
                    <span className="preview-discount-value">
                      −{formatCurrency(preview.discountAmount)}
                    </span>
                  </div>
                )}

                <div className="preview-total-row">
                  <span className="preview-total-label">Final Total</span>
                  <span className="preview-total-value">{formatCurrency(preview.total)}</span>
                </div>

                <div className={`approval-banner ${preview.approvalRequired ? 'approval-required' : 'approval-not-required'}`}>
                  <strong>
                    {preview.approvalRequired ? '⚠ Approval Required' : '✓ No Approval Required'}
                  </strong>
                  {preview.approvalRequired && preview.approvalReasons.length > 0 && (
                    <ul className="approval-reasons">
                      {preview.approvalReasons.map(reason => (
                        <li key={reason}>{REASON_LABELS[reason] || reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
