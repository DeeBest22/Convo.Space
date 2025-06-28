
import path from 'path';
import { dirname } from 'path';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';


// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// User Schema
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Authentication middleware
export const authenticateUser = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
};

// Session middleware
export const setupSession = (app) => {
  app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: 'mongodb://localhost:27017/videocall'
    }),
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
  }));
};

// Auth routes
export const setupAuthRoutes = (app) => {
  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
  });

  app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'register.html'));
  });

  app.get('/dashboard', authenticateUser, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'dashboard.html'));
  });

  app.post('/api/register', async (req, res) => {
    try {
      const { firstName, lastName, email, password } = req.body;
      
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = new User({
        firstName,
        lastName,
        email,
        password: hashedPassword
      });
      
      await user.save();
      
      res.json({ message: 'User registered successfully' });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      
      req.session.userId = user._id;
      req.session.userName = `${user.firstName} ${user.lastName}`;
      
      res.json({ 
        message: 'Login successful',
        user: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ message: 'Logout successful' });
    });
  });

  app.get('/api/user', authenticateUser, async (req, res) => {
    try {
      const user = await User.findById(req.session.userId).select('-password');
      res.json({ 
        user: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user data' });
    }
  });
};
