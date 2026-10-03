/**
 * index.js - Express App Entry Point
 *
 * This file:
 * 1. Creates the Express application
 * 2. Adds middleware (JSON parsing, CORS)
 * 3. Connects to MongoDB
 * 4. Registers the API routes
 * 5. Starts the HTTP server
 *
 * WHAT IS MIDDLEWARE?
 * Middleware is code that runs on every request before it reaches the route.
 * express.json() parses the request body from JSON text to a JavaScript object.
 * cors() allows the React frontend (on a different port) to call our backend.
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // loads .env file into process.env

const catalogRouter = require('./routes/catalog');
const quotesRouter = require('./routes/quotes');

const app = express();

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────

// Parse incoming JSON request bodies
app.use(express.json());

// Allow requests from the React frontend
// In development, the frontend runs on http://localhost:5173
// We read CLIENT_URL from the .env file so it is configurable
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
  })
);

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

// All requests to /api/catalog are handled by catalogRouter
app.use('/api/catalog', catalogRouter);

// All requests to /api/quotes are handled by quotesRouter
app.use('/api/quotes', quotesRouter);

// Health check endpoint - useful to confirm the server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────
// MONGODB CONNECTION
// ─────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/deal-desk';

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB successfully.');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1); // Exit if we cannot connect to the database
  }
}

// ─────────────────────────────────────────────
// START THE SERVER
// ─────────────────────────────────────────────
// require.main === module is true only when you run: node index.js
// When a test file does require('../index'), this condition is FALSE,
// so startServer() is NOT called — no dangling MongoDB connection in tests.
if (require.main === module) {
  startServer();
}

// Export the Express app so tests can import it and make HTTP requests
// without needing to start the server on a real port
module.exports = app;
