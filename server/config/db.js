const mongoose = require("mongoose");

let connectionPromise;

const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const mongoUri = process.env.MONGO_URI || (isProduction ? "" : "mongodb://localhost:27017/quizapp");

  if (!mongoUri) {
    throw new Error("MONGO_URI is required in production");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  try {
    connectionPromise = mongoose.connect(mongoUri);
    const conn = await connectionPromise;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    connectionPromise = null;
    console.error(`❌ MongoDB Error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
