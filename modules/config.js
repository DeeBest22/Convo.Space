import mongoose from 'mongoose';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use MongoDB Atlas instead of localhost
const MONGO_URI = 'mongodb+srv://faithabayomi18:f1vouroluw11972@dominionspecialist.cdp3oi9.mongodb.net/videocall?retryWrites=true&w=majority&appName=dominionspecialist';

export const setupDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
};

export const setupMiddleware = (app) => {
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));
};
