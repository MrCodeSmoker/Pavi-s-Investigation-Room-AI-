import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 5000);
const mongoUri = process.env.MONGODB_URI;

const startServer = async () => {
  try {
    if (!mongoUri) {
      throw new Error('MONGODB_URI is missing from the environment.');
    }

    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');

    const app = createApp();

    const server = app.listen(port, () => {
      console.log(`AI Mystery Room API listening on port ${port}`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received. Shutting down...`);

      server.close(async () => {
        try {
          await mongoose.disconnect();
          console.log('MongoDB disconnected');
          process.exit(0);
        } catch (error) {
          console.error('Shutdown failed:', error.message);
          process.exit(1);
        }
      });
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Server startup failed:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  }
};

startServer();