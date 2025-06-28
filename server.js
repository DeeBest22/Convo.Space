import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { setupDatabase, setupMiddleware } from './modules/config.js';
import { setupSession, setupAuthRoutes } from './modules/auth.js';
import { setupSocketIO } from './modules/call.js';
import { setupFileShare } from './modules/fileShare.js';
import { setupChat } from './modules/chat.js';
import { setupPoll } from './modules/poll.js';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Setup middleware
setupMiddleware(app);

// Setup session
setupSession(app);

// Setup database
setupDatabase();

// Setup auth routes
setupAuthRoutes(app);

// Setup Socket.IO and meeting routes
const { io, setupMeetingRoutes } = setupSocketIO(server);
setupMeetingRoutes(app);

// Setup chat functionality
const { setupChatSocketHandlers } = setupChat(app, io);

// Setup file sharing functionality
const fileShareAPI = setupFileShare(app, io);

// Setup poll functionality
const pollAPI = setupPoll(app, io);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Default route
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// Chat route
app.get('/chat', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
  } else {
    res.redirect('/');
  }
});

// File sharing dashboard route
app.get('/files', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'files.html'));
  } else {
    res.redirect('/');
  }
});

// Poll dashboard route
app.get('/poll', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'poll.html'));
  } else {
    res.redirect('/');
  }
});

// Enhanced Socket.IO connection handling to include call, chat, and poll functionality
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Setup chat handlers for this socket
  const { handleChatDisconnect } = setupChatSocketHandlers(socket);
  
  // Setup poll handlers for this socket
  const { handlePollDisconnect } = pollAPI.setupPollSocketHandlers(socket);
  
  // Override the original disconnect handler to include chat and poll cleanup
  const originalDisconnectHandler = socket.listeners('disconnect')[0];
  socket.removeAllListeners('disconnect');
  
  socket.on('disconnect', () => {
    // Handle chat cleanup
    handleChatDisconnect();
    
    // Handle poll cleanup
    handlePollDisconnect();
    
    // Call original disconnect handler if it exists (from call.js)
    if (originalDisconnectHandler) {
      originalDisconnectHandler();
    }
    
    console.log('User disconnected:', socket.id);
  });
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  fileShareAPI.saveData(); // Save any pending file data
  pollAPI.saveData(); // Save any pending poll data
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  fileShareAPI.saveData(); // Save any pending file data
  pollAPI.saveData(); // Save any pending poll data
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('File sharing module loaded and configured');
  console.log('Chat module loaded and configured');
  console.log('Poll module loaded and configured');
});