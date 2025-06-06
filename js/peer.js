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
      if (users.length > 0) {
        // There are other users in the room, connect to them
        this.connectToPeers(users);
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
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    };
    
    this.peer = new RTCPeerConnection(configuration);
    
    // Set up event handlers for the peer connection
    this.peer.onicecandidate = (event) => {
      console.log('ICE candidate event:', event.candidate);
      if (event.candidate) {
        console.log('Sending ICE candidate to:', this.remoteUserId);
        this.socket.emit('ice-candidate', {
          target: this.remoteUserId,
          candidate: event.candidate
        });
      } else {
        console.log('All ICE candidates have been sent');
      }
    };
    
    this.peer.ontrack = (event) => {
      console.log('Remote track received:', event);
      this.remoteStream = event.streams[0];
      this.callbacks.onRemoteStreamReceived(this.remoteStream);
    };
    
    this.peer.onconnectionstatechange = () => {
      console.log(`Connection state changed to: ${this.peer.connectionState}`);
      this.updateStatus(`Connection state: ${this.peer.connectionState}`);
      if (this.peer.connectionState === 'connected') {
        console.log('Peer connection established successfully!');
        this.callbacks.onConnectionEstablished();
      } else if (this.peer.connectionState === 'disconnected' || 
                this.peer.connectionState === 'failed' || 
                this.peer.connectionState === 'closed') {
        console.log('Peer connection failed or closed');
        this.callbacks.onConnectionClosed();
      }
    };

    this.peer.onicecandidateerror = (event) => {
      console.error('ICE candidate error:', event);
    };

    this.peer.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${this.peer.iceConnectionState}`);
    };

    this.peer.onicegatheringstatechange = () => {
      console.log(`ICE gathering state: ${this.peer.iceGatheringState}`);
    };
    
    // Set up data channel
    if (this.isInitiator) {
      console.log('Creating data channel as initiator');
      this.dataChannel = this.peer.createDataChannel('whiteboard');
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
    
    // Add local stream if available
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peer.addTrack(track, this.localStream);
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
    this.remoteUserId = users[0].socketId;
    this.isInitiator = true; // Set as initiator BEFORE initializing connection
    this.initializePeerConnection();
    
    // Create and send offer
    try {
      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      
      this.socket.emit('offer', {
        target: this.remoteUserId,
        sdp: this.peer.localDescription
      });
      
      this.updateStatus('Offer sent to remote peer');
    } catch (error) {
      console.error('Error creating offer:', error);
      this.updateStatus('Error creating offer');
    }
  }

  // Handle received offer
  async handleOffer(payload) {
    console.log('Received offer from:', payload.caller);
    this.remoteUserId = payload.caller;
    this.isInitiator = false; // Force non-initiator when receiving offer
    this.initializePeerConnection();
    
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

  // Get local media stream
  async getLocalStream(videoEnabled = true, audioEnabled = true) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled,
        audio: audioEnabled
      });
      return this.localStream;
    } catch (error) {
      console.error('Error getting local stream:', error);
      this.updateStatus('Error accessing camera/microphone');
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
      this.dataChannel.send(data);
      return true;
    }
    return false;
  }

  // Set callbacks
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Update connection status
  updateStatus(status) {
    console.log(status);
    this.callbacks.onStatusChange(status);
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