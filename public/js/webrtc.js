// Enhanced WebRTC Manager for Production Deployment
class EnhancedWebRTCManager {
  constructor(socket) {
    this.socket = socket;
    this.localStream = null;
    this.screenStream = null;
    this.peerConnections = new Map();
    this.remoteStreams = new Map();
    this.isScreenSharing = false;
    this.audioContext = null;
    this.isReady = false;
    this.connectionRetries = new Map();
    this.maxRetries = 3;
    this.retryDelay = 2000;
    
    // Enhanced ICE configuration for production
    this.configuration = {
      iceServers: [
        // Google STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        
        // Additional STUN servers
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.voiparound.com' },
        { urls: 'stun:stun.voipbuster.com' },
        { urls: 'stun:stun.voipstunt.com' },
        { urls: 'stun:stun.voxgratia.org' },
        
        // Free TURN servers for NAT traversal
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turns:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:relay1.expressturn.com:3478',
          username: 'efJBIBF6DKC8QY93',
          credential: 'Ghq1ZGdoZJLqYn8r'
        },
        {
          urls: 'turn:a.relay.metered.ca:80',
          username: 'a4cc581e5619ffd4e64c22a6',
          credential: 'uL/BTND1qmCaQMEP'
        },
        {
          urls: 'turn:a.relay.metered.ca:80?transport=tcp',
          username: 'a4cc581e5619ffd4e64c22a6',
          credential: 'uL/BTND1qmCaQMEP'
        },
        {
          urls: 'turn:a.relay.metered.ca:443',
          username: 'a4cc581e5619ffd4e64c22a6',
          credential: 'uL/BTND1qmCaQMEP'
        },
        {
          urls: 'turns:a.relay.metered.ca:443?transport=tcp',
          username: 'a4cc581e5619ffd4e64c22a6',
          credential: 'uL/BTND1qmCaQMEP'
        }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    this.setupSocketListeners();
    this.setupHeartbeat();
  }

  setupHeartbeat() {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.socket.emit('heartbeat');
    }, 30000);

    this.socket.on('heartbeat-ack', () => {
      console.log('Heartbeat acknowledged');
    });
  }

  setupSocketListeners() {
    this.socket.on('initiate-connection', async (data) => {
      const { targetSocketId, shouldCreateOffer, iceServers, connectionId } = data;
      console.log(`Initiating connection with ${targetSocketId}, shouldCreateOffer: ${shouldCreateOffer}`);
      
      // Update ICE servers if provided
      if (iceServers && iceServers.length > 0) {
        this.configuration.iceServers = iceServers;
      }
      
      if (shouldCreateOffer) {
        await this.createPeerConnection(targetSocketId, true, connectionId);
      } else {
        await this.createPeerConnection(targetSocketId, false, connectionId);
      }
    });

    this.socket.on('offer', async (data) => {
      await this.handleOffer(data);
    });

    this.socket.on('answer', async (data) => {
      await this.handleAnswer(data);
    });

    this.socket.on('ice-candidate', async (data) => {
      await this.handleIceCandidate(data);
    });

    this.socket.on('restart-connection', async (data) => {
      const { targetSocketId, retryCount } = data;
      console.log(`Restarting connection with ${targetSocketId}, retry ${retryCount}`);
      await this.restartConnection(targetSocketId);
    });

    this.socket.on('connection-max-retries', (data) => {
      const { targetSocketId } = data;
      console.log(`Max retries reached for connection with ${targetSocketId}`);
      this.handleMaxRetriesReached(targetSocketId);
    });
  }

  async initialize() {
    try {
      // Enhanced media constraints for better quality
      const constraints = {
        video: { 
          width: { min: 640, ideal: 1280, max: 1920 }, 
          height: { min: 480, ideal: 720, max: 1080 },
          frameRate: { min: 15, ideal: 30, max: 60 },
          facingMode: 'user'
        },
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        }
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Start audio level monitoring
      this.startAudioLevelMonitoring();
      
      console.log('Local stream initialized with enhanced settings');
      return true;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      
      // Fallback to lower quality if high quality fails
      try {
        const fallbackConstraints = {
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            frameRate: { ideal: 15 }
          },
          audio: { 
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };
        
        this.localStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        this.startAudioLevelMonitoring();
        console.log('Local stream initialized with fallback settings');
        return true;
      } catch (fallbackError) {
        console.error('Fallback media access also failed:', fallbackError);
        return false;
      }
    }
  }

  setReady() {
    this.isReady = true;
    this.socket.emit('participant-ready');
  }

  startAudioLevelMonitoring() {
    if (!this.localStream) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = this.audioContext.createAnalyser();
      const microphone = this.audioContext.createMediaStreamSource(this.localStream);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      microphone.connect(analyser);
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const checkAudioLevel = () => {
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume();
        }
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalizedLevel = average / 255;

        // Send audio level to server for auto-spotlight
        this.socket.emit('audio-level', { level: normalizedLevel });

        requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (error) {
      console.error('Error setting up audio monitoring:', error);
    }
  }

  async createPeerConnection(remoteSocketId, shouldCreateOffer, connectionId) {
    try {
      console.log(`Creating peer connection with ${remoteSocketId}, shouldCreateOffer: ${shouldCreateOffer}`);
      
      // Close existing connection if it exists
      if (this.peerConnections.has(remoteSocketId)) {
        const existingConnection = this.peerConnections.get(remoteSocketId);
        existingConnection.close();
        this.peerConnections.delete(remoteSocketId);
      }

      const peerConnection = new RTCPeerConnection(this.configuration);
      this.peerConnections.set(remoteSocketId, peerConnection);

      // Enhanced connection state monitoring
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log(`Connection state with ${remoteSocketId}:`, state);
        
        this.socket.emit('connection-state-change', {
          targetSocketId: remoteSocketId,
          state: state
        });

        switch (state) {
          case 'connected':
            console.log(`Successfully connected to ${remoteSocketId}`);
            this.connectionRetries.delete(remoteSocketId);
            this.socket.emit('connection-success', { targetSocketId: remoteSocketId });
            break;
          case 'failed':
            console.log(`Connection failed with ${remoteSocketId}`);
            this.handleConnectionFailure(remoteSocketId);
            break;
          case 'disconnected':
            console.log(`Disconnected from ${remoteSocketId}`);
            break;
        }
      };

      // Enhanced ICE connection state monitoring
      peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection.iceConnectionState;
        console.log(`ICE connection state with ${remoteSocketId}:`, iceState);
        
        if (iceState === 'failed' || iceState === 'disconnected') {
          this.handleConnectionFailure(remoteSocketId);
        }
      };

      // Add local stream tracks with enhanced settings
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          const sender = peerConnection.addTrack(track, this.localStream);
          
          // Configure encoding parameters for better quality
          if (track.kind === 'video') {
            const params = sender.getParameters();
            if (params.encodings && params.encodings.length > 0) {
              params.encodings[0].maxBitrate = 2000000; // 2 Mbps
              params.encodings[0].maxFramerate = 30;
              sender.setParameters(params);
            }
          }
        });
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote track from:', remoteSocketId);
        const [remoteStream] = event.streams;
        this.remoteStreams.set(remoteSocketId, remoteStream);
        this.updateRemoteVideo(remoteSocketId, remoteStream);
      };

      // Enhanced ICE candidate handling
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('ice-candidate', {
            target: remoteSocketId,
            candidate: event.candidate,
            connectionId: connectionId
          });
        } else {
          console.log('ICE gathering completed for', remoteSocketId);
        }
      };

      // Handle ICE gathering state
      peerConnection.onicegatheringstatechange = () => {
        console.log(`ICE gathering state with ${remoteSocketId}:`, peerConnection.iceGatheringState);
      };

      // Create and send offer if we should
      if (shouldCreateOffer) {
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
          iceRestart: false
        });
        
        await peerConnection.setLocalDescription(offer);
        
        this.socket.emit('offer', {
          target: remoteSocketId,
          offer: offer,
          connectionId: connectionId
        });
      }
    } catch (error) {
      console.error('Error creating peer connection:', error);
      this.handleConnectionFailure(remoteSocketId);
    }
  }

  async handleOffer(data) {
    const { offer, sender, connectionId } = data;
    console.log(`Handling offer from ${sender}`);
    
    try {
      let peerConnection = this.peerConnections.get(sender);
      
      if (!peerConnection) {
        peerConnection = new RTCPeerConnection(this.configuration);
        this.peerConnections.set(sender, peerConnection);

        // Setup event handlers (same as in createPeerConnection)
        this.setupPeerConnectionHandlers(peerConnection, sender);

        // Add local stream tracks
        if (this.localStream) {
          this.localStream.getTracks().forEach(track => {
            const senderObj = peerConnection.addTrack(track, this.localStream);
            
            // Configure encoding parameters
            if (track.kind === 'video') {
              const params = senderObj.getParameters();
              if (params.encodings && params.encodings.length > 0) {
                params.encodings[0].maxBitrate = 2000000;
                params.encodings[0].maxFramerate = 30;
                senderObj.setParameters(params);
              }
            }
          });
        }
      }

      // Set remote description and create answer
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnection.setLocalDescription(answer);
      
      this.socket.emit('answer', {
        target: sender,
        answer: answer,
        connectionId: connectionId
      });
    } catch (error) {
      console.error('Error handling offer:', error);
      this.handleConnectionFailure(sender);
    }
  }

  setupPeerConnectionHandlers(peerConnection, remoteSocketId) {
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`Connection state with ${remoteSocketId}:`, state);
      
      this.socket.emit('connection-state-change', {
        targetSocketId: remoteSocketId,
        state: state
      });

      switch (state) {
        case 'connected':
          console.log(`Successfully connected to ${remoteSocketId}`);
          this.connectionRetries.delete(remoteSocketId);
          this.socket.emit('connection-success', { targetSocketId: remoteSocketId });
          break;
        case 'failed':
          console.log(`Connection failed with ${remoteSocketId}`);
          this.handleConnectionFailure(remoteSocketId);
          break;
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState;
      console.log(`ICE connection state with ${remoteSocketId}:`, iceState);
      
      if (iceState === 'failed' || iceState === 'disconnected') {
        this.handleConnectionFailure(remoteSocketId);
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Received remote track from:', remoteSocketId);
      const [remoteStream] = event.streams;
      this.remoteStreams.set(remoteSocketId, remoteStream);
      this.updateRemoteVideo(remoteSocketId, remoteStream);
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          target: remoteSocketId,
          candidate: event.candidate
        });
      }
    };
  }

  async handleAnswer(data) {
    const { answer, sender, connectionId } = data;
    console.log(`Handling answer from ${sender}`);
    
    const peerConnection = this.peerConnections.get(sender);
    
    if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling answer:', error);
        this.handleConnectionFailure(sender);
      }
    }
  }

  async handleIceCandidate(data) {
    const { candidate, sender, connectionId } = data;
    const peerConnection = this.peerConnections.get(sender);
    
    if (peerConnection && peerConnection.remoteDescription) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
        // Don't fail the entire connection for ICE candidate errors
      }
    }
  }

  handleConnectionFailure(remoteSocketId) {
    const retries = this.connectionRetries.get(remoteSocketId) || 0;
    
    if (retries < this.maxRetries) {
      this.connectionRetries.set(remoteSocketId, retries + 1);
      console.log(`Connection failed with ${remoteSocketId}, retry ${retries + 1}/${this.maxRetries}`);
      
      this.socket.emit('connection-failed', {
        targetSocketId: remoteSocketId,
        retryCount: retries + 1
      });
    } else {
      console.log(`Max retries reached for ${remoteSocketId}`);
      this.connectionRetries.delete(remoteSocketId);
    }
  }

  async restartConnection(remoteSocketId) {
    console.log(`Restarting connection with ${remoteSocketId}`);
    
    // Close existing connection
    const existingConnection = this.peerConnections.get(remoteSocketId);
    if (existingConnection) {
      existingConnection.close();
      this.peerConnections.delete(remoteSocketId);
    }
    
    // Wait a bit before restarting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create new connection
    await this.createPeerConnection(remoteSocketId, true);
  }

  handleMaxRetriesReached(remoteSocketId) {
    console.log(`Max retries reached for ${remoteSocketId}, giving up`);
    
    // Clean up the failed connection
    const peerConnection = this.peerConnections.get(remoteSocketId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(remoteSocketId);
    }
    
    this.remoteStreams.delete(remoteSocketId);
    this.connectionRetries.delete(remoteSocketId);
    
    // Notify UI about the failed connection
    if (window.showToast) {
      window.showToast(`Failed to connect to participant after multiple attempts`, 'error');
    }
  }

  updateRemoteVideo(socketId, stream) {
    // Wait a bit for the DOM to be ready
    setTimeout(() => {
      const videoWrapper = document.querySelector(`[data-socket-id="${socketId}"]`);
      if (videoWrapper) {
        const video = videoWrapper.querySelector('.video-frame');
        if (video && video.srcObject !== stream) {
          video.srcObject = stream;
          video.play().catch(e => console.error('Error playing video:', e));
        }
      }
    }, 100);
  }

  getRemoteStream(socketId) {
    return this.remoteStreams.get(socketId);
  }

  removePeerConnection(socketId) {
    const peerConnection = this.peerConnections.get(socketId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(socketId);
    }
    this.remoteStreams.delete(socketId);
    this.connectionRetries.delete(socketId);
  }

  async toggleAudio(enabled) {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
      }
    }
  }

  async toggleVideo(enabled) {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
      }
    }
  }

  async startScreenShare() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          cursor: 'always',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Replace video track in all peer connections
      const videoTrack = this.screenStream.getVideoTracks()[0];
      
      for (const [socketId, peerConnection] of this.peerConnections) {
        const sender = peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
          
          // Update encoding parameters for screen share
          const params = sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0].maxBitrate = 3000000; // 3 Mbps for screen share
            params.encodings[0].maxFramerate = 30;
            sender.setParameters(params);
          }
        }
      }

      // Update local video to show screen share
      const localVideo = document.querySelector(`[data-socket-id="${this.socket.id}"] .video-frame`);
      if (localVideo) {
        localVideo.srcObject = this.screenStream;
      }

      // Add screen share label
      const localWrapper = document.querySelector(`[data-socket-id="${this.socket.id}"]`);
      if (localWrapper) {
        let label = localWrapper.querySelector('.video-label');
        if (!label) {
          label = document.createElement('div');
          label.className = 'video-label';
          localWrapper.appendChild(label);
        }
        label.innerHTML = '<i class="fas fa-desktop"></i> Screen Share';
      }

      // Handle screen share end
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      this.isScreenSharing = true;
      
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }

  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Replace back to camera video
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      
      for (const [socketId, peerConnection] of this.peerConnections) {
        const sender = peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
          
          // Reset encoding parameters
          const params = sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0].maxBitrate = 2000000; // Back to 2 Mbps
            params.encodings[0].maxFramerate = 30;
            sender.setParameters(params);
          }
        }
      }

      // Update local video back to camera
      const localVideo = document.querySelector(`[data-socket-id="${this.socket.id}"] .video-frame`);
      if (localVideo) {
        localVideo.srcObject = this.localStream;
      }

      // Remove screen share label
      const localWrapper = document.querySelector(`[data-socket-id="${this.socket.id}"]`);
      if (localWrapper) {
        const label = localWrapper.querySelector('.video-label');
        if (label) {
          label.remove();
        }
      }
    }

    this.isScreenSharing = false;
  }

  // Cleanup method
  destroy() {
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all peer connections
    for (const [socketId, peerConnection] of this.peerConnections) {
      peerConnection.close();
    }
    this.peerConnections.clear();

    // Stop local streams
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
    }

    // Clear maps
    this.remoteStreams.clear();
    this.connectionRetries.clear();
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedWebRTCManager;
} else {
  window.EnhancedWebRTCManager = EnhancedWebRTCManager;
}