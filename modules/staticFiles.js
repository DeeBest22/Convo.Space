import express from 'express';
import path from 'path';

export function setupStaticFiles(app) {
  // Serve static files from public directory
  app.use(express.static(path.join(process.cwd(), 'public')));
}