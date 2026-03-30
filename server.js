const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
const port = process.env.PORT || 80;

// Cloudinary Setup
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ storage: multer.memoryStorage() });

// Neon Connection
console.log('Connecting to database...');
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database Table
const initDb = async () => {
    try {
        console.log('Initializing database schema...');
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
        console.log('✅ Database initialized successfully');
    } catch (err) {
        console.error('❌ Error initializing database:', err.message);
    }
};
initDb();

// UI Endpoint: Check submission status
app.get('/api/check-submission', async (req, res) => {
    const { order_id } = req.query;
    if (!order_id) return res.status(400).json({ error: 'order_id is required' });
    try {
        const result = await pool.query('SELECT 1 FROM feedback WHERE order_id = $1', [order_id]);
        return res.json({ submitted: result.rows.length > 0 });
    } catch (err) {
        console.error('Check error:', err.message);
        return res.status(500).json({ error: 'Database error' });
    }
});

// NEW Secure Image Upload Endpoint
app.post('/api/upload-image', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Stream upload to Cloudinary (using API key/secret safely on backend)
  const stream = cloudinary.uploader.upload_stream(
    { folder: 'feedback_form' },
    (error, result) => {
      if (error) {
        console.error('Cloudinary error:', error);
        return res.status(500).json({ error: 'Cloudinary upload failed' });
      }
      res.json({ secure_url: result.secure_url });
    }
  );
  stream.end(req.file.buffer);
});

// UI Endpoint: Submit feedback
app.post('/api/submit-feedback', async (req, res) => {
    const { order_id, rating, barriers, encourage, open_feedback, nps, image_url } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id is required' });

    try {
        const check = await pool.query('SELECT 1 FROM feedback WHERE order_id = $1', [order_id]);
        if (check.rows.length > 0) return res.status(409).json({ error: 'Already submitted' });

        await pool.query(
            'INSERT INTO feedback (order_id, rating, barriers, encourage, open_feedback, nps, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [order_id, rating, barriers, encourage, open_feedback, nps, image_url]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Submission error:', err.message);
        return res.status(500).json({ error: 'Database error' });
    }
});

// Static assets
app.use('/feedback_form', express.static(path.join(__dirname, 'public')));
app.use('/', express.static(path.join(__dirname, 'public')));

app.get('/feedback_form/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(port, () => {
    console.log(`🚀 Server listening on port ${port}`);
});
