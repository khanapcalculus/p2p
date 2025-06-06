document.addEventListener('DOMContentLoaded', () => {
  // Initialize components
  const whiteboard = new Whiteboard();
  const peerConnection = new PeerConnection();
  const ui = new UI();
  
  // Signaling server URL (update with your Render.com URL when deployed)
  const signalingServer = 'https://serverp2p.onrender.com';
  
  // Set up UI callbacks
  ui.setCallbacks({
    onToolChange: (tool) => {
      whiteboard.setTool(tool);
    },
    onColorChange: (color) => {
      whiteboard.setColor(color);
    },
    onBrushSizeChange: (size) => {
      whiteboard.setBrushSize(size);
    },
    onClearCanvas: () => {
      whiteboard.clearCanvas();
    },
    onToggleVideo: () => {
      return peerConnection.toggleVideo();
    },
    onToggleAudio: () => {
      return peerConnection.toggleAudio();
    },
    onShareScreen: async () => {
      const screenStream = await peerConnection.shareScreen();
      if (screenStream) {
        ui.setLocalStream(screenStream);
      }
    },
    onCreateRoom: async (roomId, userName, role) => {
      // Initialize media
      const stream = await peerConnection.getLocalStream();
      if (stream) {
        ui.setLocalStream(stream);
      }
      
      // Initialize signaling
      peerConnection.initializeSignaling(signalingServer);
      
      // Join room as initiator
      peerConnection.joinRoom(roomId, userName);
    },
    onJoinRoom: async (roomId, userName, role) => {
      // Initialize media
      const stream = await peerConnection.getLocalStream();
      if (stream) {
        ui.setLocalStream(stream);
      }
      
      // Initialize signaling
      peerConnection.initializeSignaling(signalingServer);
      
      // Join existing room
      peerConnection.joinRoom(roomId, userName);
    }
  });
  
  // Set up peer connection callbacks
  peerConnection.setCallbacks({
    onConnectionEstablished: () => {
      ui.updateStatus('Connected to remote peer');
    },
    onConnectionClosed: () => {
      ui.updateStatus('Connection closed');
      ui.setRemoteStream(null);
    },
    onDataReceived: (data) => {
      // Update whiteboard with received data
      whiteboard.updateFromJSON(data);
    },
    onRemoteStreamReceived: (stream) => {
      ui.setRemoteStream(stream);
    },
    onStatusChange: (status) => {
      ui.updateStatus(status);
    }
  });
  
  // Set up whiteboard callback for sending data
  whiteboard.setChangeCallback((canvasData) => {
    peerConnection.sendData(canvasData);
  });
});