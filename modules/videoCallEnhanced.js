// modules/videoCallEnhanced.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Enhanced Meeting class with all video call functionality
class Meeting {
  constructor(id, hostId, hostName) {
    this.id = id;
    this.hostId = hostId;
    this.hostName = hostName;
    this.participants = new Map();
    this.coHosts = new Set();
    this.spotlightedParticipant = null;
    this.screenShares = new Map();
    this.createdAt = new Date();
    this.autoSpotlightEnabled = true;
    this.manualSpotlight = false;
    this.raisedHands = new Set();
    this.isRecording = false;
    this.recordingStartTime = null;
  }

  addParticipant(socketId, name, isHost = false) {
    const participant = {
      socketId,
      name,
      isHost,
      isCoHost: false,
      isMuted: false,
      isCameraOff: false,
      isSpotlighted: false,
      isScreenSharing: false,
      audioLevel: 0,
      joinedAt: new Date(),
      isReady: false,
      handRaised: false
    };
    
    this.participants.set(socketId, participant);
    
    // Auto-spotlight host when they join
    if (isHost && !this.spotlightedParticipant) {
      this.spotlightParticipant(socketId);
    }
    
    return participant;
  }

  removeParticipant(socketId) {
    this.participants.delete(socketId);
    this.coHosts.delete(socketId);
    this.screenShares.delete(socketId);
    this.raisedHands.delete(socketId);
    
    if (this.spotlightedParticipant === socketId) {
      this.spotlightedParticipant = null;
      this.manualSpotlight = false;
    }
  }

  setParticipantReady(socketId) {
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.isReady = true;
    }
  }

  getReadyParticipants() {
    return Array.from(this.participants.values()).filter(p => p.isReady);
  }

  makeCoHost(socketId) {
    const participant = this.participants.get(socketId);
    if (participant && !participant.isHost) {
      participant.isCoHost = true;
      this.coHosts.add(socketId);
    }
  }

  removeCoHost(socketId) {
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.isCoHost = false;
      this.coHosts.delete(socketId);
    }
  }

  spotlightParticipant(socketId) {
    // Remove previous spotlight
    if (this.spotlightedParticipant) {
      const prevSpotlighted = this.participants.get(this.spotlightedParticipant);
      if (prevSpotlighted) {
        prevSpotlighted.isSpotlighted = false;
      }
    }

    // Set new spotlight
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.isSpotlighted = true;
      this.spotlightedParticipant = socketId;
      this.manualSpotlight = true;
    }
  }

  removeSpotlight() {
    if (this.spotlightedParticipant) {
      const participant = this.participants.get(this.spotlightedParticipant);
      if (participant) {
        participant.isSpotlighted = false;
      }
      this.spotlightedParticipant = null;
      this.manualSpotlight = false;
    }
  }

  handleAudioActivity(socketId, audioLevel) {
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.audioLevel = audioLevel;
      
      // Auto-spotlight based on audio activity if no manual spotlight
      if (!this.manualSpotlight && this.autoSpotlightEnabled && audioLevel > 0.3) {
        if (this.spotlightedParticipant !== socketId) {
          this.spotlightParticipant(socketId);
          this.manualSpotlight = false; // Keep auto-spotlight enabled
          return true; // Indicate spotlight changed
        }
      }
    }
    return false;
  }

  addScreenShare(socketId, streamId) {
    this.screenShares.set(socketId, {
      streamId,
      startedAt: new Date()
    });
    
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.isScreenSharing = true;
    }
  }

  removeScreenShare(socketId) {
    this.screenShares.delete(socketId);
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.isScreenSharing = false;
    }
  }

  // Raise hand methods
  raiseHand(socketId) {
    this.raisedHands.add(socketId);
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.handRaised = true;
    }
  }

  lowerHand(socketId) {
    this.raisedHands.delete(socketId);
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.handRaised = false;
    }
  }

  getRaisedHands() {
    return Array.from(this.raisedHands);
  }

  canPerformHostAction(socketId) {
    const participant = this.participants.get(socketId);
    return participant && (participant.isHost || participant.isCoHost);
  }

  canMakeCoHost(socketId) {
    const participant = this.participants.get(socketId);
    return participant && participant.isHost;
  }

  // Recording methods
  startRecording() {
    this.isRecording = true;
    this.recordingStartTime = new Date();
  }

  stopRecording() {
    this.isRecording = false;
    this.recordingStartTime = null;
  }
}

module.exports = (app, io) => {
  // User Schema (if not already defined)
  let User;
  try {
    User = mongoose.model('User');
  } catch (error) {
    const userSchema = new mongoose.Schema({
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    });
    User = mongoose.model('User', userSchema);
  }

  // Store meeting data
  const meetings = new Map();
  const participants = new Map();
  
  // Data persistence
  const dataFile = path.join(__dirname, '../data/videoCall.json');
  
  // Load existing data
  const loadData = () => {
    try {
      if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        // Note: We don't restore meetings on server restart for security
        console.log('Video call module data loaded');
      }
    } catch (error) {
      console.error('Error loading video call data:', error);
    }
  };

  // Save data
  const saveData = () => {
    try {
      const data = {
        activeMeetings: meetings.size,
        activeParticipants: participants.size,
        timestamp: new Date().toISOString()
      };
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving video call data:', error);
    }
  };

  // Authentication middleware
  const authenticateUser = (req, res, next) => {
    if (req.session && req.session.userId) {
      next();
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  };

  // Video call routes
  app.get('/video-call', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'videoCall.html'));
  });

  app.get('/video-call/host/:meetingId', authenticateUser, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'meetingHost.html'));
  });

  app.get('/video-call/join/:meetingId', authenticateUser, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'meetingJoin.html'));
  });

  // API Routes for video calling
  app.post('/api/video-call/create-meeting', authenticateUser, (req, res) => {
    const meetingId = uuidv4().substring(0, 8).toUpperCase();
    
    res.json({ 
      meetingId,
      hostUrl: `/video-call/host/${meetingId}`,
      joinUrl: `/video-call/join/${meetingId}`
    });
  });

  app.get('/api/video-call/meeting/:meetingId', authenticateUser, (req, res) => {
    const { meetingId } = req.params;
    const meeting = meetings.get(meetingId);
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({
      id: meeting.id,
      hostName: meeting.hostName,
      participantCount: meeting.participants.size,
      createdAt: meeting.createdAt,
      isRecording: meeting.isRecording
    });
  });

  // Socket.IO handlers for video calling
  io.on('connection', (socket) => {
    // Join meeting as host
    socket.on('join-as-host', (data) => {
      const { meetingId, hostName } = data;
      
      // Create new meeting
      const meeting = new Meeting(meetingId, socket.id, hostName);
      meetings.set(meetingId, meeting);
      
      // Add host as participant
      meeting.addParticipant(socket.id, hostName, true);
      
      // Join socket room
      socket.join(meetingId);
      
      // Store participant info
      participants.set(socket.id, { meetingId, isHost: true });
      
      socket.emit('joined-meeting', {
        meetingId,
        isHost: true,
        participants: Array.from(meeting.participants.values()),
        spotlightedParticipant: meeting.spotlightedParticipant,
        raisedHands: meeting.getRaisedHands(),
        isRecording: meeting.isRecording
      });

      console.log(`Host ${hostName} created meeting ${meetingId}`);
    });

    // Join meeting as participant
    socket.on('join-meeting', (data) => {
      const { meetingId, participantName } = data;
      const meeting = meetings.get(meetingId);
      
      if (!meeting) {
        socket.emit('meeting-error', { message: 'Meeting not found' });
        return;
      }

      // Add participant to meeting
      meeting.addParticipant(socket.id, participantName);
      
      // Join socket room
      socket.join(meetingId);
      
      // Store participant info
      participants.set(socket.id, { meetingId, isHost: false });
      
      // Notify participant
      socket.emit('joined-meeting', {
        meetingId,
        isHost: false,
        participants: Array.from(meeting.participants.values()),
        spotlightedParticipant: meeting.spotlightedParticipant,
        screenShares: Array.from(meeting.screenShares.entries()),
        raisedHands: meeting.getRaisedHands(),
        isRecording: meeting.isRecording
      });

      // Notify all participants about new participant
      socket.to(meetingId).emit('participant-joined', {
        participant: meeting.participants.get(socket.id),
        participants: Array.from(meeting.participants.values())
      });

      console.log(`Participant ${participantName} joined meeting ${meetingId}`);
    });

    // Participant ready for WebRTC
    socket.on('participant-ready', () => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      meeting.setParticipantReady(socket.id);
      
      // Notify all other ready participants to initiate connections
      const readyParticipants = meeting.getReadyParticipants();
      readyParticipants.forEach(participant => {
        if (participant.socketId !== socket.id) {
          // Tell existing participants to create connection to new participant
          io.to(participant.socketId).emit('initiate-connection', {
            targetSocketId: socket.id,
            shouldCreateOffer: true
          });
          
          // Tell new participant to expect connection from existing participant
          socket.emit('initiate-connection', {
            targetSocketId: participant.socketId,
            shouldCreateOffer: false
          });
        }
      });

      console.log(`Participant ${socket.id} is ready for WebRTC connections`);
    });

    // WebRTC signaling
    socket.on('offer', (data) => {
      socket.to(data.target).emit('offer', {
        offer: data.offer,
        sender: socket.id
      });
    });

    socket.on('answer', (data) => {
      socket.to(data.target).emit('answer', {
        answer: data.answer,
        sender: socket.id
      });
    });

    socket.on('ice-candidate', (data) => {
      socket.to(data.target).emit('ice-candidate', {
        candidate: data.candidate,
        sender: socket.id
      });
    });

    // Audio level monitoring for auto-spotlight
    socket.on('audio-level', (data) => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const spotlightChanged = meeting.handleAudioActivity(socket.id, data.level);
      
      if (spotlightChanged) {
        // Notify all participants about spotlight change
        io.to(participantInfo.meetingId).emit('participant-spotlighted', {
          spotlightedParticipant: meeting.spotlightedParticipant,
          participants: Array.from(meeting.participants.values()),
          reason: 'audio-activity'
        });
      }
    });

    // Reaction handling
    socket.on('send-reaction', (data) => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;

      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const participant = meeting.participants.get(socket.id);
      if (!participant) return;

      // Broadcast reaction to all participants in the meeting
      io.to(participantInfo.meetingId).emit('reaction-received', {
        emoji: data.emoji,
        participantName: participant.name,
        socketId: socket.id,
        timestamp: data.timestamp
      });
    });

    // Raise hand handling
    socket.on('raise-hand', () => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;

      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const participant = meeting.participants.get(socket.id);
      if (!participant) return;

      meeting.raiseHand(socket.id);

      // Notify all participants about raised hand
      io.to(participantInfo.meetingId).emit('hand-raised', {
        socketId: socket.id,
        participantName: participant.name,
        raisedHands: meeting.getRaisedHands()
      });
    });

    socket.on('lower-hand', () => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;

      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const participant = meeting.participants.get(socket.id);
      if (!participant) return;

      meeting.lowerHand(socket.id);

      // Notify all participants about lowered hand
      io.to(participantInfo.meetingId).emit('hand-lowered', {
        socketId: socket.id,
        participantName: participant.name,
        raisedHands: meeting.getRaisedHands()
      });
    });

    // Screen sharing
    socket.on('start-screen-share', (data) => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      meeting.addScreenShare(socket.id, data.streamId);
      
      // Notify all participants about screen share
      socket.to(participantInfo.meetingId).emit('screen-share-started', {
        participantId: socket.id,
        streamId: data.streamId,
        participantName: meeting.participants.get(socket.id)?.name
      });
    });

    socket.on('stop-screen-share', () => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      meeting.removeScreenShare(socket.id);
      
      // Notify all participants about screen share stop
      socket.to(participantInfo.meetingId).emit('screen-share-stopped', {
        participantId: socket.id
      });
    });

    // Host controls
    socket.on('spotlight-participant', (data) => {
      const { targetSocketId } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canPerformHostAction(socket.id)) {
        socket.emit('action-error', { message: 'Insufficient permissions' });
        return;
      }

      meeting.spotlightParticipant(targetSocketId);
      
      // Notify all participants
      io.to(participantInfo.meetingId).emit('participant-spotlighted', {
        spotlightedParticipant: targetSocketId,
        participants: Array.from(meeting.participants.values()),
        reason: 'manual'
      });
    });

    socket.on('remove-spotlight', () => {
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canPerformHostAction(socket.id)) {
        socket.emit('action-error', { message: 'Insufficient permissions' });
        return;
      }

      meeting.removeSpotlight();
      
      // Notify all participants
      io.to(participantInfo.meetingId).emit('spotlight-removed', {
        participants: Array.from(meeting.participants.values())
      });
    });

    socket.on('mute-participant', (data) => {
      const { targetSocketId } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canPerformHostAction(socket.id)) {
        socket.emit('action-error', { message: 'Insufficient permissions' });
        return;
      }

      const targetParticipant = meeting.participants.get(targetSocketId);
      if (targetParticipant) {
        targetParticipant.isMuted = !targetParticipant.isMuted;
        
        // Notify target participant
        io.to(targetSocketId).emit('force-mute', {
          isMuted: targetParticipant.isMuted
        });
        
        // Notify all participants about the change
        io.to(participantInfo.meetingId).emit('participant-muted', {
          targetSocketId,
          isMuted: targetParticipant.isMuted,
          participants: Array.from(meeting.participants.values())
        });
      }
    });

    socket.on('make-cohost', (data) => {
      const { targetSocketId } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canMakeCoHost(socket.id)) {
        socket.emit('action-error', { message: 'Only host can make co-hosts' });
        return;
      }

      meeting.makeCoHost(targetSocketId);
      
      // Notify target participant
      io.to(targetSocketId).emit('made-cohost');
      
      // Notify all participants
      io.to(participantInfo.meetingId).emit('cohost-assigned', {
        targetSocketId,
        participants: Array.from(meeting.participants.values())
      });
    });

    socket.on('kick-participant', (data) => {
      const { targetSocketId } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const requester = meeting.participants.get(socket.id);
      const target = meeting.participants.get(targetSocketId);
      
      if (!requester || !target) return;
      
      // Only host can kick, and cannot kick co-hosts
      if (!requester.isHost || target.isCoHost) {
        socket.emit('action-error', { message: 'Cannot kick this participant' });
        return;
      }

      // Remove participant from meeting
      meeting.removeParticipant(targetSocketId);
      participants.delete(targetSocketId);
      
      // Notify kicked participant
      io.to(targetSocketId).emit('kicked-from-meeting');
      
      // Notify remaining participants
      socket.to(participantInfo.meetingId).emit('participant-kicked', {
        targetSocketId,
        participants: Array.from(meeting.participants.values())
      });

      // Disconnect the kicked participant
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(participantInfo.meetingId);
        targetSocket.disconnect();
      }
    });

    // Toggle own mic/camera
    socket.on('toggle-mic', (data) => {
      const { isMuted } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const participant = meeting.participants.get(socket.id);
      if (participant) {
        participant.isMuted = isMuted;
        
        // Notify all participants
        socket.to(participantInfo.meetingId).emit('participant-audio-changed', {
          socketId: socket.id,
          isMuted,
          participants: Array.from(meeting.participants.values())
        });
      }
    });

    socket.on('toggle-camera', (data) => {
      const { isCameraOff } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const participant = meeting.participants.get(socket.id);
      if (participant) {
        participant.isCameraOff = isCameraOff;
        
        // Notify all participants
        socket.to(participantInfo.meetingId).emit('participant-video-changed', {
          socketId: socket.id,
          isCameraOff,
          participants: Array.from(meeting.participants.values())
        });
      }
    });

    // Recording controls
    socket.on('start-recording', () => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canPerformHostAction(socket.id)) {
        socket.emit('action-error', { message: 'Insufficient permissions' });
        return;
      }

      meeting.startRecording();
      
      // Notify all participants
      io.to(participantInfo.meetingId).emit('recording-started', {
        startTime: meeting.recordingStartTime
      });
    });

    socket.on('stop-recording', () => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canPerformHostAction(socket.id)) {
        socket.emit('action-error', { message: 'Insufficient permissions' });
        return;
      }

      meeting.stopRecording();
      
      // Notify all participants
      io.to(participantInfo.meetingId).emit('recording-stopped');
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      const participantInfo = participants.get(socket.id);
      
      if (participantInfo) {
        const meeting = meetings.get(participantInfo.meetingId);
        
        if (meeting) {
          const participant = meeting.participants.get(socket.id);
          
          // Remove participant from meeting
          meeting.removeParticipant(socket.id);
          
          // If host disconnects, end the meeting
          if (participantInfo.isHost) {
            // Notify all participants that meeting ended
            socket.to(participantInfo.meetingId).emit('meeting-ended');
            
            // Clean up meeting
            meetings.delete(participantInfo.meetingId);
            
            console.log(`Meeting ${participantInfo.meetingId} ended - host disconnected`);
          } else {
            // Notify remaining participants
            socket.to(participantInfo.meetingId).emit('participant-left', {
              socketId: socket.id,
              participantName: participant?.name,
              participants: Array.from(meeting.participants.values())
            });
          }
        }
        
        participants.delete(socket.id);
      }
    });
  });

  // Load initial data
  loadData();

  // Return module interface
  return {
    getMeetings: () => meetings,
    getParticipants: () => participants,
    getMeetingCount: () => meetings.size,
    getParticipantCount: () => participants.size,
    saveData,
    loadData
  };
};