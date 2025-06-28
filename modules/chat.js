import multer from 'multer';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const setupChat = (app, io) => {
  // Configuration
  let config = {
    chatEnabled: true,
    generalOnly: false,
    allowGroupCreation: true
  };

  // Create uploads directory
  const uploadsDir = path.join(process.cwd(), 'public/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.use('/uploads', express.static(uploadsDir));

  // Multer setup for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, uploadsDir); },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
  });
  const upload = multer({ storage });

  // File upload endpoint
  app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `/uploads/${req.file.filename}`;
    const filename = req.file.originalname;
    res.json({ fileUrl, filename });
  });

  // Configuration endpoints
  app.post('/update-chat-toggle', (req, res) => {
    config.chatEnabled = !req.body.disabled;
    io.emit('configChanged', config);
    res.sendStatus(200);
  });

  app.get('/get-chat-toggle', (req, res) => {
    res.json({ disabled: !config.chatEnabled });
  });

  // In-memory storage
  let users = {};
  let groups = {};

  // Chat socket handlers
  const setupChatSocketHandlers = (socket) => {
    socket.emit('existingGroups', Object.values(groups));
    socket.emit('configChanged', config);

    socket.on('register', (name) => {
      users[socket.id] = name;
      io.emit('updateUsers', users);
    });

    // Update configuration
    socket.on('updateConfig', (newConfig) => {
      config = { ...config, ...newConfig };
      io.emit('configChanged', config);
    });

    // Send text messages
    socket.on('sendMessage', (data) => {
      const senderName = users[socket.id];
      if (data.to === 'general') {
        io.emit('receiveGeneralMessage', { 
          id: data.id, 
          from: senderName, 
          fromSocketId: socket.id,
          message: data.message, 
          type: 'text',
          timestamp: new Date().toISOString()
        });
      } else {
        const messageData = {
          id: data.id, 
          from: senderName, 
          fromSocketId: socket.id, 
          to: data.to,
          message: data.message, 
          type: 'text',
          timestamp: new Date().toISOString()
        };
        
        // Send to recipient only
        io.to(data.to).emit('receivePrivateMessage', messageData);
        // Send back to sender with a different event to avoid duplication
        socket.emit('privateMessageSent', messageData);
      }
    });

    // Delete message
    socket.on('deleteMessage', (data) => {
      if (data.to === 'general') {
        io.emit('messageDeleted', { id: data.id, chat: 'general' });
      } else if (data.to.startsWith("group-")) {
        let group = groups[data.to];
        if (group) {
          group.members.forEach(memberId => {
            io.to(memberId).emit('messageDeleted', { id: data.id, chat: data.to });
          });
        }
      } else {
        const parts = data.to.split("-");
        io.to(parts[0]).emit('messageDeleted', { id: data.id, chat: data.to });
        io.to(parts[1]).emit('messageDeleted', { id: data.id, chat: data.to });
      }
    });

    // Send media messages
    socket.on('sendMedia', (data) => {
      const senderName = users[socket.id];
      const messageData = { 
        id: data.id, 
        from: senderName, 
        message: data.fileUrl, 
        type: data.fileType, 
        filename: data.filename,
        timestamp: new Date().toISOString()
      };

      if (data.to === 'general') {
        messageData.fromSocketId = socket.id;
        io.emit('receiveGeneralMessage', messageData);
      } else {
        messageData.fromSocketId = socket.id;
        messageData.to = data.to;
        // Send to recipient only
        io.to(data.to).emit('receivePrivateMessage', messageData);
        // Send back to sender with different event
        socket.emit('privateMessageSent', messageData);
      }
    });

    // Edit message
    socket.on('editMessage', (data) => {
      const senderName = users[socket.id];
      const editedData = { 
        id: data.id, 
        from: senderName, 
        newMessage: data.newMessage, 
        edited: true, 
        type: 'text',
        timestamp: new Date().toISOString()
      };

      if (data.to === 'general') {
        io.emit('messageEdited', { ...editedData, chat: 'general' });
      } else if (data.to.startsWith("group-")) {
        let group = groups[data.to];
        if (group) {
          group.members.forEach(member => {
            io.to(member).emit('messageEdited', { ...editedData, chat: data.to });
          });
        }
      } else {
        const parts = data.to.split("-");
        io.to(parts[0]).emit('messageEdited', { ...editedData, chat: data.to });
        io.to(parts[1]).emit('messageEdited', { ...editedData, chat: data.to });
      }
    });

    // Typing indicators
    socket.on('typing', (data) => {
      if (data.to === 'general') {
        socket.broadcast.emit('displayTyping', { 
          from: users[socket.id], 
          conversation: 'general', 
          socketId: socket.id 
        });
      } else if (data.to.startsWith("group-")) {
        let group = groups[data.to];
        if (group) {
          group.members.forEach(member => {
            if (member !== socket.id) {
              io.to(member).emit('displayTyping', { 
                from: users[socket.id], 
                conversation: data.to, 
                socketId: socket.id 
              });
            }
          });
        }
      } else {
        io.to(data.to).emit('displayTyping', { 
          from: users[socket.id], 
          conversation: data.conversation, 
          socketId: socket.id 
        });
      }
    });

    socket.on('stopTyping', (data) => {
      if (data.to === 'general') {
        socket.broadcast.emit('removeTyping', { 
          from: users[socket.id], 
          conversation: 'general', 
          socketId: socket.id 
        });
      } else if (data.to.startsWith("group-")) {
        let group = groups[data.to];
        if (group) {
          group.members.forEach(member => {
            if (member !== socket.id) {
              io.to(member).emit('removeTyping', { 
                from: users[socket.id], 
                conversation: data.to, 
                socketId: socket.id 
              });
            }
          });
        }
      } else {
        const parts = data.conversation.split("-");
        io.to(parts[0]).emit('removeTyping', { 
          from: users[socket.id], 
          conversation: data.conversation, 
          socketId: socket.id 
        });
        io.to(parts[1]).emit('removeTyping', { 
          from: users[socket.id], 
          conversation: data.conversation, 
          socketId: socket.id 
        });
      }
    });

    // Group events
    socket.on('createGroup', (data) => {
      const groupId = 'group-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const group = {
        id: groupId,
        host: socket.id,
        hostName: users[socket.id],
        name: data.groupName,
        open: data.open,
        members: [socket.id]
      };
      groups[groupId] = group;
      
      // Emit to all users so they can see the new group
      io.emit('groupCreated', group);
    });

    socket.on('requestJoinGroup', (data) => {
      const group = groups[data.groupId];
      if (group) {
        if (group.open) {
          // For open groups, automatically add the user
          if (!group.members.includes(socket.id)) {
            group.members.push(socket.id);
          }
          socket.emit('joinedGroup', group);
          io.emit('groupUpdated', group);
        } else {
          // For private groups, send request to host
          io.to(group.host).emit('joinGroupRequest', { 
            groupId: data.groupId, 
            requesterId: socket.id, 
            requesterName: users[socket.id] 
          });
        }
      }
    });

    socket.on('acceptJoinGroup', (data) => {
      const group = groups[data.groupId];
      if (group && group.host === socket.id) {
        if (!group.members.includes(data.requesterId)) {
          group.members.push(data.requesterId);
        }
        io.to(data.requesterId).emit('joinedGroup', group);
        io.emit('groupUpdated', group);
      }
    });

    socket.on('sendGroupMessage', (data) => {
      const group = groups[data.groupId];
      if (group && group.members.includes(socket.id)) {
        const senderName = users[socket.id];
        const msg = { 
          id: data.id, 
          from: senderName, 
          fromSocketId: socket.id,
          message: data.message, 
          type: data.type || 'text', 
          groupId: data.groupId,
          timestamp: new Date().toISOString()
        };
        
        // Send to all group members
        group.members.forEach(member => {
          io.to(member).emit('receiveGroupMessage', msg);
        });
      }
    });

    // Chat cleanup on disconnect
    const handleChatDisconnect = () => {
      delete users[socket.id];
      io.emit('updateUsers', users);
      
      // Clean up groups
      for (let groupId in groups) {
        const group = groups[groupId];
        group.members = group.members.filter(id => id !== socket.id);
        if (group.host === socket.id) {
          delete groups[groupId];
          io.emit('groupDeleted', { groupId });
        } else if (group.members.length > 0) {
          io.emit('groupUpdated', group);
        }
      }
    };

    return { handleChatDisconnect };
  };

  return { setupChatSocketHandlers, config };
};