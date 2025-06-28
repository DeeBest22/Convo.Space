// modules/poll.js
export function setupPoll(app, io) {
  // In-memory data storage
  const rooms = new Map(); // Map of roomId to room data
  const polls = new Map(); // Map of pollId to poll data

  // Initialize default room
  function initializeRoom(roomId) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: [],
        activePolls: [],
        endedPolls: [] // Array for ended polls
      });
    }
  }

  // API Routes
  app.post('/api/rooms/join', (req, res) => {
    const { roomId, userId } = req.body;

    if (!roomId || !userId) {
      return res.status(400).json({ success: false, error: 'roomId and userId are required' });
    }

    initializeRoom(roomId);

    const room = rooms.get(roomId);
    let participant = room.participants.find(p => p.id === userId);

    if (!participant) {
      participant = {
        id: userId,
        username: 'Anonymous', // Default to Anonymous
        isOnline: true
      };
      room.participants.push(participant);
    } else {
      participant.isOnline = true;
    }

    // Assign host if no participants were present
    const isHost = room.participants.length === 1;

    res.json({
      success: true,
      isHost,
      participants: room.participants,
      activePolls: room.activePolls,
      endedPolls: room.endedPolls // Include ended polls
    });
  });

  // Setup Socket.IO handlers for polling
  function setupPollSocketHandlers(socket) {
    socket.on('join-room', ({ roomId, userId }) => {
      socket.join(roomId);
      
      initializeRoom(roomId);
      const room = rooms.get(roomId);

      let participant = room.participants.find(p => p.id === userId);
      if (participant) {
        participant.isOnline = true;
      }

      // Broadcast updated participant list
      io.to(roomId).emit('user-joined', {
        participants: room.participants
      });
    });

    socket.on('create-poll', ({ roomId, userId, pollData }) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const pollId = 'poll-' + Math.random().toString(36).substr(2, 9);
      const endTime = pollData.duration ? Date.now() + pollData.duration * 1000 : null;

      const poll = {
        id: pollId,
        creatorId: userId,
        creatorName: 'Anonymous',
        question: pollData.question,
        options: pollData.options.map((text, index) => ({
          id: index,
          text,
          votes: 0
        })),
        voters: {},
        active: true,
        isAnonymous: pollData.isAnonymous || false,
        isMultiSelect: pollData.isMultiSelect || false,
        maxSelections: pollData.maxSelections || 1,
        createdAt: Date.now(),
        endTime
      };

      polls.set(pollId, poll);
      room.activePolls.push(poll);

      io.to(roomId).emit('poll-created', poll);

      // Auto-end poll if duration is set
      if (endTime) {
        setTimeout(() => {
          const poll = polls.get(pollId);
          if (poll && poll.active) {
            poll.active = false;
            room.activePolls = room.activePolls.filter(p => p.id !== pollId);
            room.endedPolls.push(poll); // Move to ended polls
            io.to(roomId).emit('poll-ended', { pollId, poll });
          }
        }, pollData.duration * 1000);
      }
    });

    socket.on('submit-vote', ({ roomId, userId, pollId, selectedOptions }) => {
      const poll = polls.get(pollId);
      if (!poll || !poll.active) {
        socket.emit('error', { message: 'Poll not found or inactive' });
        return;
      }

      if (poll.isMultiSelect && selectedOptions.length > poll.maxSelections) {
        socket.emit('error', { message: `Maximum ${poll.maxSelections} selections allowed` });
        return;
      }

      // Remove previous votes by this user
      if (poll.voters[userId]) {
        poll.voters[userId].selectedOptions.forEach(optionId => {
          poll.options[optionId].votes = Math.max(0, poll.options[optionId].votes - 1);
        });
      }

      // Record new votes
      poll.voters[userId] = { selectedOptions };
      selectedOptions.forEach(optionId => {
        if (poll.options[optionId]) {
          poll.options[optionId].votes += 1;
        }
      });

      io.to(roomId).emit('poll-updated', poll);
    });

    socket.on('end-poll', ({ roomId, userId, pollId }) => {
      const room = rooms.get(roomId);
      const poll = polls.get(pollId);

      if (!room || !poll) {
        socket.emit('error', { message: 'Room or poll not found' });
        return;
      }

      if (poll.creatorId !== userId && !room.participants.find(p => p.id === userId && p.isHost)) {
        socket.emit('error', { message: 'Not authorized to end poll' });
        return;
      }

      poll.active = false;
      room.activePolls = room.activePolls.filter(p => p.id !== pollId);
      room.endedPolls.push(poll); // Move to ended polls

      io.to(roomId).emit('poll-ended', { pollId, poll });
    });

    socket.on('user-typing', ({ roomId, userId }) => {
      socket.to(roomId).emit('user-activity', { userId, activity: 'typing' });
    });

    // Handle poll-specific disconnect logic
    function handlePollDisconnect() {
      rooms.forEach((room, roomId) => {
        const participant = room.participants.find(p => p.id === socket.id);
        if (participant) {
          participant.isOnline = false;
          io.to(roomId).emit('user-left', {
            participants: room.participants
          });
        }
      });
    }

    return { handlePollDisconnect };
  }

  // Function to save data on shutdown (can be expanded)
  function saveData() {
    console.log('Saving poll data before shutdown...');
    // Implementation for data persistence could be added here
  }

  // Return the setup function and save data function
  return {
    setupPollSocketHandlers,
    saveData
  };
}