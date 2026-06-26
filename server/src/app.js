require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const connectDB   = require('./config/database');
const { testCloudinaryConnection } = require('./config/cloudinary');
const { errorHandler } = require('./middleware/errorHandler');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes  = require('./routes/auth');
const siteRoutes  = require('./routes/sites');
// More routes will be added as we build them:
// const reportRoutes  = require('./routes/reports');
// const driveRoutes   = require('./routes/drive');
// const billingRoutes = require('./routes/billing');

const app = express();

/* ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet()); // Sets secure HTTP headers
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods:     ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));*/


// CORS — allow both local dev and production Netlify URL
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://reportiqcl.netlify.app',
];
if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}
 
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, UptimeRobot)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      100,             // 100 requests per window per IP
  message:  { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10, // Stricter limit for auth endpoints
  message:  { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.use(globalLimiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ── Health check (Railway uses this to verify the app is running) ─────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ReportIQ API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
// Apply stricter rate limiting only to auth login/register endpoints.
// Must be mounted before the auth router so it runs before /auth routes.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/sites',   siteRoutes);
app.use('/api/reports', require('./routes/reports'));
app.use('/api/drive',   require('./routes/drive'));
app.use('/api/company', require('./routes/company'));
app.use('/api/upload',  require('./routes/upload'));
app.use('/api/settings', require('./routes/settings'));
// app.use('/api/billing', billingRoutes); — coming next

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ── Central error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to DB before accepting requests
  await connectDB();
  await testCloudinaryConnection();

  app.listen(PORT, () => {
    console.log('\n========================================');
    console.log(`  ⚡ ReportIQ API running`);
    console.log(`  Port: ${PORT}`);
    console.log(`  Mode: ${process.env.NODE_ENV}`);
    console.log('========================================\n');
  });
};

// Handle unhandled promise rejections (e.g. DB connection drop)
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err.message);
  process.exit(1);
});

startServer();

module.exports = app;
