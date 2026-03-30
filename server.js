const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Neon Connection
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DLksFlGM6C0y@ep-patient-waterfall-a1phrgrq-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database Table
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS feedback (
                id SERIAL PRIMARY KEY,
                order_id TEXT UNIQUE NOT NULL,
                rating INTEGER,
                barriers TEXT,
                encourage TEXT,
                open_feedback TEXT,
                nps INTEGER,
                image_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};
initDb();

// UI Endpoint: Check submission status
app.get('/api/check-submission', async (req, res) => {
    const { order_id } = req.query;
    if (!order_id) {
        return res.status(400).json({ error: 'order_id is required' });
    }

    try {
        const result = await pool.query('SELECT 1 FROM feedback WHERE order_id = $1', [order_id]);
        if (result.rows.length > 0) {
            return res.json({ submitted: true });
        }
        return res.json({ submitted: false });
    } catch (err) {
        console.error('Check submission error:', err);
        return res.status(500).json({ error: 'Database error' });
    }
});

// UI Endpoint: Submit feedback
app.post('/api/submit-feedback', async (req, res) => {
    const { order_id, rating, barriers, encourage, open_feedback, nps, image_url } = req.body;

    if (!order_id) {
        return res.status(400).json({ error: 'order_id is required' });
    }

    try {
        // Enforce uniqueness at application level too
        const check = await pool.query('SELECT 1 FROM feedback WHERE order_id = $1', [order_id]);
        if (check.rows.length > 0) {
            return res.status(409).json({ error: 'Feedback already submitted for this order' });
        }

        await pool.query(
            'INSERT INTO feedback (order_id, rating, barriers, encourage, open_feedback, nps, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [order_id, rating, barriers, encourage, open_feedback, nps, image_url]
        );

        return res.json({ success: true, message: 'Feedback submitted successfully' });
    } catch (err) {
        console.error('Submission error:', err);
        return res.status(500).json({ error: 'Database error' });
    }
});

// Serve frontend assets
// Serve static files from the 'public' directory
app.use('/feedback_form', express.static(path.join(__dirname, 'public')));

// SPA behavior: redirect all other requests to index.html within the subpath
app.get('/feedback_form/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Error page placeholder
app.get('/error', (req, res) => {
    res.send('<h1>Error: order_id is missing or invalid.</h1><p>Please check your link and try again.</p>');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}/feedback_form/`);
});
