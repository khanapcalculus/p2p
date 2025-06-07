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
    this.drawingBuffer = [];
    this.isSendingDrawing = false;
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
      const otherUsers = users.filter(user => user.socketId !== this.socket.id);
      
      if (otherUsers.length > 0) {
        // The user with the "smaller" socketId becomes the initiator
        this.isInitiator = this.socket.id < otherUsers[0].socketId;
        
        if (this.isInitiator) {
          this.connectToPeers(otherUsers);
        } else {
          // Non-initiator waits to receive an offer
          this.updateStatus('Waiting for connection from peer...', 'info');
        }
      } else {
        this.isInitiator = true;
        this.updateStatus('Waiting for someone to join...');
      }
    });
    
    this.socket.on('offer', (payload) => this.handleOffer(payload));
    this.socket.on('answer', (payload) => this.handleAnswer(payload));
    this.socket.on('ice-candidate', (payload) => this.handleIceCandidate(payload));
    this.socket.on('user-disconnected', (userId) => this.handlePeerDisconnection(userId));
    this.socket.on('room-full', () => this.updateStatus('Room is full. Cannot join.'));
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
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    };
    
    this.peer = new RTCPeerConnection(configuration);
    
    this.peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          target: this.remoteUserId,
          candidate: event.candidate
        });
      }
    };
    
    this.peer.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.callbacks.onRemoteStreamReceived(this.remoteStream);
    };
    
    this.peer.onconnectionstatechange = () => {
      this.updateStatus(`Connection state: ${this.peer.connectionState}`);
      if (this.peer.connectionState === 'connected') {
        this.callbacks.onConnectionEstablished();
      } else if (['disconnected', 'failed', 'closed'].includes(this.peer.connectionState)) {
        this.callbacks.onConnectionClosed();
      }
    };

    this.addLocalStreamTracks();
    
    if (this.isInitiator) {
      this.dataChannel = this.peer.createDataChannel('whiteboard', { ordered: true });
      this.setupDataChannel();
    } else {
      this.peer.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };
    }
  }

  addLocalStreamTracks() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peer.addTrack(track, this.localStream);
      });
    }
  }

  ensureMediaConnection() {
    if (this.peer && this.localStream) {
      const senders = this.peer.getSenders();
      this.localStream.getTracks().forEach(track => {
        if (!senders.find(s => s.track && s.track.kind === track.kind)) {
          this.peer.addTrack(track, this.localStream);
        }
      });
    }
  }

  setupDataChannel() {
    this.dataChannel.onopen = () => this.updateStatus('Data channel is open');
    this.dataChannel.onclose = () => this.updateStatus('Data channel is closed');
    this.dataChannel.onerror = (error) => console.error('Data channel error:', error);
    this.dataChannel.onmessage = (event) => this.callbacks.onDataReceived(event.data);
  }

  async connectToPeers(users) {
    if (users.length > 0) {
      this.remoteUserId = users[0].socketId;
      this.initializePeerConnection();
      
      if (this.isInitiator) {
        try {
          const offer = await this.peer.createOffer();
          await this.peer.setLocalDescription(offer);
          this.socket.emit('offer', { target: this.remoteUserId, sdp: offer });
        } catch (error) {
          console.error('Error creating offer:', error);
        }
      }
    }
  }

  async handleOffer(payload) {
    this.remoteUserId = payload.caller;
    // If not initiator, or if there's a connection conflict, accept the offer
    if (!this.peer) {
        this.isInitiator = false; // The one who receives offer is never the initiator
        this.initializePeerConnection();
    }
    
    try {
      await this.peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await this.peer.createAnswer();
      await this.peer.setLocalDescription(answer);
      this.socket.emit('answer', { target: this.remoteUserId, sdp: answer });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  async handleAnswer(payload) {
    try {
      if (this.peer.signalingState === 'have-local-offer') {
        await this.peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleIceCandidate(payload) {
    try {
      if (this.peer.remoteDescription) {
        await this.peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } else {
        // Queue candidates if remote description is not set yet
        this.pendingIceCandidates = this.pendingIceCandidates || [];
        this.pendingIceCandidates.push(payload.candidate);
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  handlePeerDisconnection(userId) {
    if (userId === this.remoteUserId) {
      this.updateStatus('Remote peer disconnected');
      this.callbacks.onConnectionClosed();
    }
  }

  async getLocalStream(videoEnabled = true, audioEnabled = true) {
    try {
        const constraints = {
            video: videoEnabled ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
            audio: audioEnabled ? { echoCancellation: true, noiseSuppression: true } : false
        };
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        this.ensureMediaConnection();
        return this.localStream;
    } catch (error) {
        console.error('Error accessing media devices.', error);
        this.updateStatus(`Media Error: ${error.name}. Continuing without media.`);
        // Try getting audio only if video fails
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            this.ensureMediaConnection();
            return this.localStream;
        } catch (audioError) {
            return null;
        }
    }
  }

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

  async shareScreen() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = this.peer.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(screenTrack);
      }
      screenTrack.onended = () => {
        const cameraTrack = this.localStream.getVideoTracks()[0];
        if (sender && cameraTrack) {
          sender.replaceTrack(cameraTrack);
        }
      };
    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  }

  sendData(data) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(data);
    }
  }

  // UPDATED METHOD
  sendContinuousDrawing(drawingData) {
    // drawingData is now a structured object
    const dataToSend = JSON.stringify({
      type: 'continuous-drawing',
      ...drawingData
    });

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
        // For high-frequency data, we can send it directly without complex buffering
        // to minimize latency. WebRTC's SCTP handles congestion.
        this.dataChannel.send(dataToSend);
    }
  }

  setCallbacks(callbacks) { this.callbacks = { ...this.callbacks, ...callbacks }; }
  updateStatus(status, type = 'info') { this.callbacks.onStatusChange(status, type); }
  
  close() {
    if (this.dataChannel) this.dataChannel.close();
    if (this.peer) this.peer.close();
    if (this.socket) this.socket.disconnect();
    if (this.localStream) this.localStream.getTracks().forEach(track => track.stop());
  }
}
