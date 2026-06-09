const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const configuredOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...configuredOrigins])];
const vercelPreviewPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

// Middleware
app.use(cors((req, callback) => {
  const origin = req.header("Origin");
  const protocol = req.header("x-forwarded-proto") || req.protocol;
  const requestOrigin = `${protocol}://${req.get("host")}`;
  const isAllowed =
    !origin ||
    origin === requestOrigin ||
    allowedOrigins.includes(origin) ||
    vercelPreviewPattern.test(origin);

  callback(isAllowed ? null : new Error(`CORS blocked origin: ${origin}`), {
    origin: isAllowed,
    credentials: true,
  });
}));
app.use(express.json());
app.use(morgan("dev"));

// Health check
app.get("/api/health", (req, res) => res.json({ status: "OK", timestamp: new Date() }));

app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Routes
app.use("/api/auth",    require("./routes/auth"));
app.use("/api/admin",   require("./routes/admin"));
app.use("/api/student", require("./routes/student"));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Server Error",
  });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = app;
