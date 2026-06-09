const mongoose = require("mongoose");
const dns = require("dns");

let connectionPromise;

const configureMongoDns = (mongoUri) => {
  if (!mongoUri.startsWith("mongodb+srv://")) return;

  const dnsServers = (process.env.MONGO_DNS_SERVERS || "8.8.8.8,1.1.1.1")
    .split(",")
    .map(server => server.trim())
    .filter(Boolean);

  if (dnsServers.length) {
    dns.setServers(dnsServers);
  }
};

const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const mongoUri = (process.env.MONGO_URI || process.env.MONGODB_URI || (isProduction ? "" : "mongodb://localhost:27017/quizapp")).trim();

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
    configureMongoDns(mongoUri);
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
