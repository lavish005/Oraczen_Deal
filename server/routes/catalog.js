/**
 * catalog.js - Route for GET /api/catalog
 *
 * This simply returns the catalog data so the frontend can:
 * 1. Show the list of available products
 * 2. Use the correct product names (not hardcoded in React)
 *
 * The frontend should NEVER have product prices hardcoded.
 * Prices come from here, from the backend.
 */

const express = require('express');
const router = express.Router();
const catalog = require('../catalog.json');

// GET /api/catalog
// Returns the full catalog: currency, products, discount rules
router.get('/', (req, res) => {
  res.json({
    currency: catalog.currency,
    products: catalog.products,
    discount_rules: catalog.discount_rules,
  });
});

module.exports = router;
