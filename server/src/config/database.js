const mongoose = require('mongoose');
const dns = require('dns');

const connectDB = async () => {
  if (process.env.MONGODB_URI?.startsWith('mongodb+srv://')) {
    // Use public DNS servers just for this Node process so SRV lookup works
    // without changing the machine's system DNS settings.
    dns.setServers(['8.8.8.8', '8.8.4.4']);
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // These options ensure stable connections in production
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS:          60000,
      connectTimeoutMS:         10000,
      heartbeatFrequencyMS:     10000,
      retryWrites:              true,
      retryReads:               true,
      maxPoolSize:              10,
      minPoolSize:              2,
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    // Handle connection errors after initial connection
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1); // Exit process if DB connection fails — Railway will restart it
  }
};

module.exports = connectDB;
