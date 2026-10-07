const express = require('express');
const router = express.Router();
const catalog = require('../catalog.json');

router.get('/', (req, res) => {
  res.json({
    currency: catalog.currency,
    products: catalog.products,
    discount_rules: catalog.discount_rules,
  });
});

module.exports = router;
