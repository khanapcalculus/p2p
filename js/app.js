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
      whiteboard.clearCurrentPage();
    },
    onAddPage: () => {
      const newPage = whiteboard.addNewPage();
      ui.updatePageDisplay(whiteboard.currentPageIndex + 1, whiteboard.pages.length);
    },
    onDeletePage: () => {
      if (confirm('Are you sure you want to delete this page?')) {
        const success = whiteboard.deletePage(whiteboard.currentPageIndex);
        if (success) {
          ui.updatePageDisplay(whiteboard.currentPageIndex + 1, whiteboard.pages.length);
        }
      }
    },
    onPrevPage: () => {
      if (whiteboard.goToPage(whiteboard.currentPageIndex - 1)) {
        ui.updatePageDisplay(whiteboard.currentPageIndex + 1, whiteboard.pages.length);
      }
    },
    onNextPage: () => {
      if (whiteboard.goToPage(whiteboard.currentPageIndex + 1)) {
        ui.updatePageDisplay(whiteboard.currentPageIndex + 1, whiteboard.pages.length);
      }
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
      // Initialize media with graceful fallback for tablets
      const stream = await peerConnection.getLocalStream(true, true);
      if (stream) {
        ui.setLocalStream(stream);
      }
      
      // Initialize signaling
      peerConnection.initializeSignaling(signalingServer);
      
      // Join room as initiator
      peerConnection.joinRoom(roomId, userName);
    },
    onJoinRoom: async (roomId, userName, role) => {
      // Initialize media with graceful fallback for tablets
      const stream = await peerConnection.getLocalStream(true, true);
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
      const parsedData = JSON.parse(data);
      whiteboard.updateFromData(parsedData);
      
      // Update UI page display
      if (parsedData.pageStructure) {
        ui.updatePageDisplay(
          whiteboard.currentPageIndex + 1, 
          whiteboard.pages.length
        );
      }
    },
    onRemoteStreamReceived: (stream) => {
      ui.setRemoteStream(stream);
    },
    onStatusChange: (status) => {
      ui.updateStatus(status);
    }
  });
  
  // Set up whiteboard callbacks
  whiteboard.setChangeCallback((data) => {
    // Send page data to peer
    peerConnection.sendData(JSON.stringify(data));
  });
  
  whiteboard.setPageChangeCallback((pageIndex, page) => {
    // Update UI when page changes
    ui.updatePageDisplay(pageIndex + 1, whiteboard.pages.length);
  });
  
  whiteboard.setPagesChangeCallback((pageStructure) => {
    // Update UI when pages are added/removed
    ui.updatePageDisplay(
      whiteboard.currentPageIndex + 1, 
      whiteboard.pages.length
    );
  });
});