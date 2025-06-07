class PeerConnection {
  constructor() {
    this.peers = {}; // Store multiple peer connections
    this.localStream = null;
    this.socket = null;
    this.roomId = null;
    this.callbacks = {};
  }

  initializeSignaling(serverUrl) {
    this.socket = io(serverUrl);

    this.socket.on('connect', () => this.updateStatus('✅ Connected to signaling server'));
    this.socket.on('users-in-room', (users) => this.handleNewUsers(users));
    this.socket.on('user-joined', (user) => this.handleNewUsers([user]));
    this.socket.on('offer', (payload) => this.handleOffer(payload));
    this.socket.on('answer', (payload) => this.handleAnswer(payload));
    this.socket.on('ice-candidate', (payload) => this.handleIceCandidate(payload));
    this.socket.on('user-disconnected', (socketId) => this.handleUserDisconnection(socketId));
  }

  joinRoom(roomId, userId) {
    this.roomId = roomId;
    this.socket.emit('join-room', roomId, userId);
    this.updateStatus(`Joining room: ${roomId}`);
  }

  handleNewUsers(users) {
    console.log('Received new users to connect to:', users);
    for (const user of users) {
      const peerId = user.socketId;
      if (peerId === this.socket.id || this.peers[peerId]) continue; // Don't connect to self or existing peers

      console.log(`Initiating connection to ${peerId}`);
      const isInitiator = this.socket.id > peerId; // Deterministic initiator
      const peer = this.createPeerConnection(peerId, isInitiator);
      this.peers[peerId] = peer;

      if (isInitiator) {
        this.createOffer(peer, peerId);
      }
    }
  }

  createPeerConnection(peerId, isInitiator) {
    const peer = new RTCPeerConnection({
      iceServers: [ { urls: 'stun:stun.l.google.com:19302' } ]
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
      }
    };
    
    peer.ontrack = (event) => {
      console.log(`Received remote stream from ${peerId}`);
      if (this.callbacks.onRemoteStreamReceived) {
        this.callbacks.onRemoteStreamReceived(event.streams[0]);
      }
    };

    peer.onconnectionstatechange = () => {
      this.updateStatus(`Connection with ${peerId} is ${peer.connectionState}`);
      if (peer.connectionState === 'connected' && this.callbacks.onConnectionEstablished) {
        this.callbacks.onConnectionEstablished();
      }
    };
    
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => peer.addTrack(track, this.localStream));
    }
    
    if (isInitiator) {
        const dataChannel = peer.createDataChannel('whiteboard');
        this.setupDataChannel(dataChannel);
        peer.dataChannel = dataChannel;
    } else {
        peer.ondatachannel = (event) => {
            this.setupDataChannel(event.channel);
            peer.dataChannel = event.channel;
        };
    }

    return peer;
  }

  async createOffer(peer, peerId) {
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      this.socket.emit('offer', { target: peerId, sdp: offer });
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  }

  async handleOffer(payload) {
    const peerId = payload.caller;
    console.log(`Handling offer from ${peerId}`);
    
    const peer = this.peers[peerId] || this.createPeerConnection(peerId, false);
    
    await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    
    this.socket.emit('answer', { target: peerId, sdp: answer });
  }

  async handleAnswer(payload) {
    const peerId = payload.answerer;
    console.log(`Handling answer from ${peerId}`);
    const peer = this.peers[peerId];
    if (peer) {
      await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    }
  }

  async handleIceCandidate(payload) {
    const peer = this.peers[payload.sender];
    if (peer && payload.candidate) {
      await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
    }
  }

  setupDataChannel(dataChannel) {
    dataChannel.onopen = () => this.updateStatus('Data channel is open');
    dataChannel.onclose = () => this.updateStatus('Data channel is closed');
    dataChannel.onmessage = (event) => {
      if(this.callbacks.onDataReceived) this.callbacks.onDataReceived(event.data);
    };
    this.dataChannel = dataChannel; // Assume one data channel for simplicity
  }
  
  sendData(data) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(data);
    }
  }

  sendContinuousDrawing(drawingData) {
    const dataToSend = JSON.stringify({ type: 'continuous-drawing', ...drawingData });
    this.sendData(dataToSend);
  }

  handleUserDisconnection(socketId) {
    if (this.peers[socketId]) {
      this.peers[socketId].close();
      delete this.peers[socketId];
      this.updateStatus(`User ${socketId} disconnected`);
      if(this.callbacks.onConnectionClosed) this.callbacks.onConnectionClosed();
    }
  }
  
  async getLocalStream(videoEnabled = true, audioEnabled = true) {
    try {
      const constraints = {
        video: videoEnabled,
        audio: audioEnabled,
      };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      // Add tracks to all existing peer connections
      for (const peerId in this.peers) {
          this.localStream.getTracks().forEach(track => this.peers[peerId].addTrack(track, this.localStream));
      }
      return this.localStream;
    } catch (err) {
      this.updateStatus(`Media Error: ${err.message}`, 'error');
      return null;
    }
  }

  // Other methods (toggleVideo, toggleAudio, etc.) remain largely the same.
  toggleVideo() { if(this.localStream) this.localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled); }
  toggleAudio() { if(this.localStream) this.localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled); }

  setCallbacks(callbacks) { this.callbacks = callbacks; }
  updateStatus(status, type = 'info') { if(this.callbacks.onStatusChange) this.callbacks.onStatusChange(status, type); }
}
