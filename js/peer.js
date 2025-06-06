class PeerConnection {
  constructor() {
    this.peer = null;
    this.connection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.socket = null;
    this.roomId = null;
    this.userId = null;
    this.isInitiator = false;
    this.callbacks = {
      onConnectionEstablished: () => {},
      onConnectionClosed: () => {},
      onDataReceived: () => {},
      onRemoteStreamReceived: () => {},
      onStatusChange: () => {}
    };
  }

  // Initialize the connection to the signaling server
  initializeSignaling(serverUrl) {
    this.socket = io(serverUrl);
    
    this.socket.on('connect', () => {
      this.updateStatus('Connected to signaling server');
    });
    
    this.socket.on('users-in-room', (users) => {
      console.log('Received users in room:', users);
      console.log('My user ID:', this.userId);
      console.log('Current initiator status:', this.isInitiator);
      
      if (users.length > 0) {
        // Filter out self if somehow included
        const otherUsers = users.filter(user => {
          const userSocketId = typeof user === 'object' ? user.socketId : user;
          return userSocketId !== this.socket.id;
        });
        
        console.log('Other users after filtering:', otherUsers);
        
        if (otherUsers.length > 0) {
          // Use a deterministic method to decide who is initiator
          // The user with the "smaller" socketId becomes the initiator
          const shouldBeInitiator = this.socket.id < otherUsers[0].socketId;
          
          console.log(`Comparing socket IDs: mine (${this.socket.id}) vs theirs (${otherUsers[0].socketId})`);
          console.log(`Should be initiator: ${shouldBeInitiator}`);
          
          this.isInitiator = shouldBeInitiator;
          this.connectToPeers(otherUsers);
        } else {
          this.isInitiator = true;
          this.updateStatus('Waiting for someone to join...');
        }
      } else {
        this.isInitiator = true;
        this.updateStatus('Waiting for someone to join...');
      }
    });
    
    this.socket.on('offer', (payload) => {
      this.handleOffer(payload);
    });
    
    this.socket.on('answer', (payload) => {
      this.handleAnswer(payload);
    });
    
    this.socket.on('ice-candidate', (payload) => {
      this.handleIceCandidate(payload);
    });
    
    this.socket.on('user-disconnected', (userId) => {
      this.handlePeerDisconnection(userId);
    });
    
    this.socket.on('room-full', () => {
      this.updateStatus('Room is full. Cannot join.');
    });
  }

  // Join a room
  joinRoom(roomId, userId) {
    this.roomId = roomId;
    this.userId = userId;
    this.socket.emit('join-room', roomId, userId);
    this.updateStatus(`Joining room: ${roomId}`);
  }

  // Initialize WebRTC peer connection
  initializePeerConnection() {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
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
        }
      ],
      iceCandidatePoolSize: 10
    };
    
    this.peer = new RTCPeerConnection(configuration);
    
    // Set up event handlers for the peer connection
    this.peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to:', this.remoteUserId);
        this.socket.emit('ice-candidate', {
          target: this.remoteUserId,
          candidate: event.candidate
        });
      }
    };
    
    this.peer.ontrack = (event) => {
      console.log('Remote track received:', event.streams[0]);
      console.log('Track details:', event.track);
      console.log('Track kind:', event.track.kind);
      console.log('Track enabled:', event.track.enabled);
      console.log('Track ready state:', event.track.readyState);
      
      this.remoteStream = event.streams[0];
      this.callbacks.onRemoteStreamReceived(this.remoteStream);
      this.updateStatus('Receiving remote audio/video', 'success');
    };
    
    // Add track event listener for debugging
    this.peer.addEventListener('track', (event) => {
      console.log('Track event fired:', event);
    });
    
    // Monitor senders for debugging
    this.peer.addEventListener('signalingstatechange', () => {
      console.log('Signaling state:', this.peer.signalingState);
      if (this.peer.signalingState === 'stable') {
        const senders = this.peer.getSenders();
        console.log('Active senders:', senders);
        senders.forEach((sender, index) => {
          if (sender.track) {
            console.log(`Sender ${index}: ${sender.track.kind} track`, sender.track);
          } else {
            console.log(`Sender ${index}: No track`);
          }
        });
      }
    });
    
    this.peer.onconnectionstatechange = () => {
      console.log(`Connection state changed to: ${this.peer.connectionState}`);
      this.updateStatus(`Connection state: ${this.peer.connectionState}`);
      if (this.peer.connectionState === 'connected') {
        console.log('Peer connection established successfully!');
        this.callbacks.onConnectionEstablished();
        this.updateStatus('Connected to peer', 'success');
      } else if (this.peer.connectionState === 'disconnected' || 
                this.peer.connectionState === 'failed' || 
                this.peer.connectionState === 'closed') {
        console.log('Peer connection failed or closed');
        this.callbacks.onConnectionClosed();
        this.updateStatus('Peer connection lost', 'error');
      }
    };

    this.peer.onicecandidateerror = (event) => {
      // Only log errors that might be significant, not all failed candidates
      if (event.errorCode !== 701) { // 701 is a common "host candidate" error that's usually not critical
        console.warn('ICE candidate error (non-critical):', event.errorText || 'Unknown error');
      }
    };

    this.peer.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${this.peer.iceConnectionState}`);
      if (this.peer.iceConnectionState === 'connected' || this.peer.iceConnectionState === 'completed') {
        this.updateStatus('P2P connection established', 'success');
      } else if (this.peer.iceConnectionState === 'failed') {
        this.updateStatus('P2P connection failed - trying to reconnect...', 'warning');
        // Try to restart ICE
        this.peer.restartIce();
      }
    };

    this.peer.onicegatheringstatechange = () => {
      console.log(`ICE gathering state: ${this.peer.iceGatheringState}`);
    };
    
    // Add local stream tracks BEFORE creating data channel
    this.addLocalStreamTracks();
    
    // Set up data channel
    if (this.isInitiator) {
      console.log('Creating data channel as initiator');
      this.dataChannel = this.peer.createDataChannel('whiteboard', {
        ordered: true,
        maxRetransmits: 3
      });
      console.log('Data channel created:', this.dataChannel);
      this.setupDataChannel();
    } else {
      console.log('Waiting for data channel as non-initiator');
      this.peer.ondatachannel = (event) => {
        console.log('Data channel received from remote peer:', event.channel);
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };
    }
  }

  // Separate method to add local stream tracks
  addLocalStreamTracks() {
    if (this.localStream) {
      console.log('Adding local stream tracks to peer connection:', this.localStream);
      
      // Add all tracks from local stream
      this.localStream.getTracks().forEach(track => {
        console.log(`Adding ${track.kind} track:`, track);
        const sender = this.peer.addTrack(track, this.localStream);
        console.log('Track added, sender:', sender);
      });
      
      console.log('All local tracks added to peer connection');
      this.updateStatus('Local media added to connection', 'success');
    } else {
      console.log('No local stream available to add to peer connection');
      this.updateStatus('No local media to share', 'warning');
    }
  }

  // Method to ensure media is properly connected after getting stream
  ensureMediaConnection() {
    if (this.peer && this.localStream) {
      // Check if tracks are already added
      const senders = this.peer.getSenders();
      const hasVideoSender = senders.some(sender => sender.track && sender.track.kind === 'video');
      const hasAudioSender = senders.some(sender => sender.track && sender.track.kind === 'audio');
      
      console.log('Current senders:', senders);
      console.log('Has video sender:', hasVideoSender);
      console.log('Has audio sender:', hasAudioSender);
      
      // Add missing tracks
      this.localStream.getTracks().forEach(track => {
        const existingSender = senders.find(sender => 
          sender.track && sender.track.kind === track.kind
        );
        
        if (!existingSender) {
          console.log(`Adding missing ${track.kind} track:`, track);
          this.peer.addTrack(track, this.localStream);
        }
      });
    }
  }

  // Set up the data channel for whiteboard data
  setupDataChannel() {
    console.log('Setting up data channel:', this.dataChannel);
    
    this.dataChannel.onopen = () => {
      console.log('Data channel opened successfully!');
      this.updateStatus('Data channel is open');
    };
    
    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
      this.updateStatus('Data channel is closed');
    };
    
    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.updateStatus('Data channel error');
    };
    
    this.dataChannel.onmessage = (event) => {
      console.log('Data received via data channel:', event.data);
      this.callbacks.onDataReceived(event.data);
    };
  }

  // Connect to peers in the room
  async connectToPeers(users) {
    if (users.length > 0) {
      // Handle both old string format and new object format
      const firstUser = users[0];
      if (typeof firstUser === 'object' && firstUser.socketId) {
        this.remoteUserId = firstUser.socketId; // Use socketId for signaling
        this.remotePeerInfo = firstUser; // Store full peer info
      } else {
        this.remoteUserId = firstUser; // Fallback to old format
        this.remotePeerInfo = { id: firstUser, socketId: firstUser };
      }
      
      console.log('Connecting to peer:', this.remotePeerInfo);
      console.log('I am initiator:', this.isInitiator);
      
      // Initialize peer connection
      this.initializePeerConnection();
      
      // Only create offer if we are the initiator
      if (this.isInitiator) {
        try {
          const offer = await this.peer.createOffer();
          await this.peer.setLocalDescription(offer);
          
          console.log('Sending offer to:', this.remoteUserId);
          this.socket.emit('offer', {
            target: this.remoteUserId,
            sdp: offer
          });
          
          this.updateStatus('Connecting to peer...', 'info');
        } catch (error) {
          console.error('Error creating offer:', error);
          this.updateStatus('Error creating connection offer', 'error');
        }
      } else {
        console.log('Waiting for offer from initiator...');
        this.updateStatus('Waiting for connection from peer...', 'info');
      }
    }
  }

  // Handle received offer
  async handleOffer(payload) {
    console.log('Received offer from:', payload.caller);
    this.remoteUserId = payload.caller;
    
    // If we already have a peer connection and we're the initiator, ignore this offer
    // to prevent signaling conflicts
    if (this.peer && this.isInitiator && this.peer.signalingState !== 'stable') {
      console.log('Ignoring offer - already have connection as initiator');
      return;
    }
    
    this.isInitiator = false; // Force non-initiator when receiving offer
    
    // Only initialize if we don't have a peer connection yet
    if (!this.peer) {
      this.initializePeerConnection();
    }
    
    try {
      console.log('Setting remote description with offer');
      await this.peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      console.log('Creating answer');
      const answer = await this.peer.createAnswer();
      console.log('Setting local description with answer');
      await this.peer.setLocalDescription(answer);
      
      console.log('Sending answer to:', this.remoteUserId);
      this.socket.emit('answer', {
        target: this.remoteUserId,
        sdp: this.peer.localDescription
      });
      
      this.updateStatus('Answer sent to remote peer');
    } catch (error) {
      console.error('Error handling offer:', error);
      this.updateStatus('Error handling offer');
    }
  }

  // Handle received answer
  async handleAnswer(payload) {
    console.log('Received answer from:', payload.answerer);
    
    // Check if we're in the right state to handle an answer
    if (!this.peer || this.peer.signalingState !== 'have-local-offer') {
      console.log('Ignoring answer - not in correct state:', this.peer?.signalingState);
      return;
    }
    
    try {
      console.log('Setting remote description with answer');
      await this.peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      console.log('Answer processed successfully');
      this.updateStatus('Connection established with remote peer');
    } catch (error) {
      console.error('Error handling answer:', error);
      this.updateStatus('Error handling answer');
    }
  }

  // Handle received ICE candidate
  async handleIceCandidate(payload) {
    console.log('Received ICE candidate from:', payload.sender);
    
    // Only process ICE candidates if we have a peer connection and remote description is set
    if (!this.peer || !this.peer.remoteDescription) {
      console.log('Ignoring ICE candidate - no peer connection or remote description');
      return;
    }
    
    try {
      await this.peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
      console.log('ICE candidate added successfully');
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  // Handle peer disconnection
  handlePeerDisconnection(userId) {
    if (userId === this.remoteUserId) {
      this.updateStatus('Remote peer disconnected');
      this.callbacks.onConnectionClosed();
    }
  }

  // Get local media stream with tablet-friendly approach
  async getLocalStream(videoEnabled = true, audioEnabled = true) {
    try {
      // Check if media devices are available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('Media devices not supported');
        this.updateStatus('Media not supported on this device', 'warning');
        return null;
      }

      // Enhanced tablet-friendly video constraints
      const videoConstraints = videoEnabled ? {
        width: { 
          min: 320,
          ideal: 640, 
          max: 1280 
        },
        height: { 
          min: 240,
          ideal: 480, 
          max: 720 
        },
        facingMode: 'user',
        frameRate: { ideal: 30, max: 60 }
      } : false;

      // Enhanced audio constraints for tablets
      const audioConstraints = audioEnabled ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 1 }
      } : false;

      this.updateStatus('Requesting camera and microphone access...', 'info');
      console.log('Attempting to access camera and microphone...');
      
      // First try: Both video and audio
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints
        });
        console.log('Successfully obtained video and audio stream');
        this.updateStatus('Camera and microphone access granted! 📹🎤', 'success');
        
        // Ensure tracks are added to peer connection if it exists
        if (this.peer) {
          this.ensureMediaConnection();
        }
        
        return this.localStream;
      } catch (error) {
        console.warn('Failed to get both video and audio:', error.name, error.message);
        
        // Handle specific tablet/mobile errors with detailed messages
        if (error.name === 'NotAllowedError') {
          this.updateStatus('🚫 Camera/microphone access denied.<br/>📱 <strong>For Tablets:</strong> Close any popup bubbles, notifications, or overlays from other apps, then click "🔄 Retry Camera".', 'error');
        } else if (error.name === 'NotFoundError') {
          this.updateStatus('📷 No camera or microphone found on this device', 'warning');
        } else if (error.name === 'NotReadableError') {
          this.updateStatus('📱 Camera/microphone is being used by another app. Please close other apps and try again.', 'warning');
        } else if (error.name === 'AbortError') {
          this.updateStatus('⚠️ Media access was aborted. Please try again.', 'warning');
        } else if (error.name === 'OverconstrainedError') {
          this.updateStatus('🔧 Camera settings not compatible. Trying simpler settings...', 'warning');
          // Try with simpler constraints
          return this.trySimpleConstraints(videoEnabled, audioEnabled);
        } else {
          this.updateStatus(`❌ Media access error: ${error.message}<br/>📱 <strong>For Tablets:</strong> Try closing all other apps and refreshing the page.`, 'error');
        }
      }
      
      // Second try: Video only if audio fails
      if (videoEnabled) {
        try {
          console.log('Trying video only...');
          this.localStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false
          });
          console.log('Video-only stream obtained');
          this.updateStatus('📹 Video access granted (no audio available)', 'success');
          
          // Ensure tracks are added to peer connection if it exists
          if (this.peer) {
            this.ensureMediaConnection();
          }
          
          return this.localStream;
        } catch (videoError) {
          console.warn('Failed to get video stream:', videoError.name, videoError.message);
          if (videoError.name === 'NotAllowedError') {
            this.updateStatus('🚫 Camera access denied', 'error');
          } else if (videoError.name === 'OverconstrainedError') {
            // Try simple video constraints
            return this.trySimpleConstraints(true, false);
          }
        }
      }
      
      // Third try: Audio only if video fails
      if (audioEnabled) {
        try {
          console.log('Trying audio only...');
          this.localStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: audioConstraints
          });
          console.log('Audio-only stream obtained');
          this.updateStatus('🎤 Audio access granted (no video available)', 'success');
          
          // Ensure tracks are added to peer connection if it exists
          if (this.peer) {
            this.ensureMediaConnection();
          }
          
          return this.localStream;
        } catch (audioError) {
          console.warn('Failed to get audio stream:', audioError.name, audioError.message);
          if (audioError.name === 'NotAllowedError') {
            this.updateStatus('🚫 Microphone access denied', 'error');
          }
        }
      }
      
      // If all media fails, continue without media but provide helpful message
      console.log('No media available, continuing without audio/video');
      this.updateStatus('📱 No camera/microphone access available.<br/>Whiteboard works without media.<br/>Try clicking "🔄 Retry Camera" or refresh the page.', 'warning');
      return null;
      
    } catch (error) {
      console.error('Unexpected error accessing media:', error);
      this.updateStatus('❌ Media access error - whiteboard will work without video/audio', 'error');
      return null;
    }
  }

  // Try simple constraints for tablet compatibility
  async trySimpleConstraints(videoEnabled, audioEnabled) {
    try {
      console.log('Trying simple constraints for tablet compatibility...');
      
      const simpleVideoConstraints = videoEnabled ? {
        width: 640,
        height: 480,
        facingMode: 'user'
      } : false;

      const simpleAudioConstraints = audioEnabled ? {
        echoCancellation: true
      } : false;

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: simpleVideoConstraints,
        audio: simpleAudioConstraints
      });

      console.log('Simple constraints successful');
      if (videoEnabled && audioEnabled) {
        this.updateStatus('📹🎤 Camera and microphone access granted (basic quality)', 'success');
      } else if (videoEnabled) {
        this.updateStatus('📹 Camera access granted (basic quality)', 'success');
      } else if (audioEnabled) {
        this.updateStatus('🎤 Microphone access granted', 'success');
      }

      // Ensure tracks are added to peer connection if it exists
      if (this.peer) {
        this.ensureMediaConnection();
      }

      return this.localStream;
    } catch (error) {
      console.warn('Simple constraints also failed:', error.name, error.message);
      this.updateStatus('❌ Unable to access camera/microphone with any settings', 'error');
      return null;
    }
  }

  // Toggle local video
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  // Toggle local audio
  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  // Share screen
  async shareScreen() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });
      
      // Replace video track
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
          this.localStream.removeTrack(videoTrack);
          videoTrack.stop();
        }
        
        const screenTrack = screenStream.getVideoTracks()[0];
        this.localStream.addTrack(screenTrack);
        
        // Replace track in peer connection
        if (this.peer) {
          const senders = this.peer.getSenders();
          const sender = senders.find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        }
        
        // Handle when user stops sharing
        screenTrack.onended = async () => {
          await this.getLocalStream();
          if (this.peer) {
            const senders = this.peer.getSenders();
            const sender = senders.find(s => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(this.localStream.getVideoTracks()[0]);
            }
          }
        };
        
        return screenStream;
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
      this.updateStatus('Error sharing screen');
      return null;
    }
  }

  // Send data through the data channel
  sendData(data) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        // Check if data channel buffer is getting full
        if (this.dataChannel.bufferedAmount > 64 * 1024) { // 64KB threshold
          console.warn('Data channel buffer is getting full, skipping update');
          return false;
        }
        
        this.dataChannel.send(data);
        return true;
      } catch (error) {
        console.error('Error sending data:', error);
        return false;
      }
    }
    return false;
  }

  // Send continuous drawing data with throttling
  sendContinuousDrawing(drawingData) {
    if (!this.drawingBuffer) {
      this.drawingBuffer = [];
      this.isSendingDrawing = false;
    }
    
    // Add to buffer
    this.drawingBuffer.push(JSON.stringify({
      type: 'continuous-drawing',
      ...drawingData
    }));
    
    // Process buffer if not already sending
    if (!this.isSendingDrawing) {
      this.processDrawingBuffer();
    }
  }

  processDrawingBuffer() {
    if (!this.drawingBuffer || this.drawingBuffer.length === 0) {
      this.isSendingDrawing = false;
      return;
    }
    
    this.isSendingDrawing = true;
    
    // Send latest drawing data (skip intermediate points for performance)
    const latestData = this.drawingBuffer.pop();
    this.drawingBuffer = []; // Clear buffer to prevent overflow
    
    this.sendData(latestData);
    
    // Schedule next batch
    setTimeout(() => {
      this.processDrawingBuffer();
    }, 16); // ~60fps
  }

  // Set callbacks
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Update connection status
  updateStatus(status, type = 'info') {
    console.log(status);
    this.callbacks.onStatusChange(status, type);
  }

  // Close the connection
  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    
    if (this.peer) {
      this.peer.close();
    }
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
  }
}