class WhiteboardApp {
  constructor() {
    this.whiteboard = new Whiteboard();
    this.peer = new PeerConnection();
    this.ui = new UI();
    this.isConnected = false;
    
    this.setupIntegrations();
  }

  setupIntegrations() {
    // Setup UI callbacks
    this.ui.setCallbacks({
      onToolChange: (tool) => this.whiteboard.setTool(tool),
      onColorChange: (color) => this.whiteboard.setColor(color),
      onBrushSizeChange: (size) => this.whiteboard.setBrushSize(size),
      onClearCanvas: () => this.clearCurrentPage(),
      onToggleVideo: () => this.peer.toggleVideo(),
      onToggleAudio: () => this.peer.toggleAudio(),
      onShareScreen: () => this.peer.shareScreen(),
      onRetryCamera: () => this.retryMediaAccess(),
      onCreateRoom: (roomId, userName, userRole) => this.createRoom(roomId, userName, userRole),
      onJoinRoom: (roomId, userName, userRole) => this.joinRoom(roomId, userName, userRole),
      onAddPage: () => this.addPage(),
      onDeletePage: () => this.deletePage(),
      onPrevPage: () => this.prevPage(),
      onNextPage: () => this.nextPage()
    });

    // Setup whiteboard callbacks
    this.whiteboard.setChangeCallback((data) => this.onCanvasChange(data));
    this.whiteboard.setPageChangeCallback((data) => this.onPageChange(data));
    this.whiteboard.setContinuousDrawingCallback((data) => this.onContinuousDrawing(data));

    // Setup peer callbacks
    this.peer.setCallbacks({
      onConnectionEstablished: () => this.onPeerConnected(),
      onConnectionClosed: () => this.onPeerDisconnected(),
      onDataReceived: (data) => this.onDataReceived(data),
      onRemoteStreamReceived: (stream) => this.ui.setRemoteStream(stream),
      onStatusChange: (status, type) => this.ui.updateStatus(status, type)
    });

    // Initialize signaling to the local server
    this.peer.initializeSignaling('http://localhost:3000');
  }

  async createRoom(roomId, userName, userRole) {
    this.ui.updateStatus('Setting up media...', 'info');
    try {
      await this.peer.getLocalStream(true, true);
      this.ui.setLocalStream(this.peer.localStream);
      this.peer.joinRoom(roomId, `${userName} (${userRole})`);
    } catch (error) {
      console.error('Error creating room:', error);
      this.ui.updateStatus('Error creating room. Continuing without media.', 'error');
      this.peer.joinRoom(roomId, `${userName} (${userRole})`);
    }
  }

  async joinRoom(roomId, userName, userRole) {
    this.ui.updateStatus('Joining room and setting up media...', 'info');
    try {
      await this.peer.getLocalStream(true, true);
      this.ui.setLocalStream(this.peer.localStream);
      this.peer.joinRoom(roomId, `${userName} (${userRole})`);
    } catch (error) {
      console.error('Error joining room:', error);
      this.ui.updateStatus('Error joining room. Continuing without media.', 'error');
      this.peer.joinRoom(roomId, `${userName} (${userRole})`);
    }
  }

  async retryMediaAccess() {
    this.ui.updateStatus('Retrying camera access...', 'info');
    const stream = await this.peer.getLocalStream(true, true);
    if (stream) {
      this.ui.setLocalStream(stream);
      this.ui.updateStatus('Media access successful!', 'success');
    } else {
      this.ui.updateStatus('Failed to get media access.', 'warning');
    }
  }

  onPeerConnected() {
    this.isConnected = true;
    this.ui.updateStatus('Connected to peer!', 'success');
    // Sync the current state to the new peer
    this.syncWhiteboard();
  }

  onPeerDisconnected() {
    this.isConnected = false;
    this.ui.updateStatus('Peer disconnected', 'warning');
    this.ui.setRemoteStream(null); // Clear the remote video feed
  }

  // Called for shapes, text, and modifications (sends full canvas state)
  onCanvasChange(data) {
    if (this.isConnected) {
      this.peer.sendData(JSON.stringify({
        type: 'canvas-change',
        ...data
      }));
    }
  }
  
  // Called only for pencil/eraser (sends only the new path)
  onContinuousDrawing(data) {
    if (this.isConnected) {
      this.peer.sendContinuousDrawing(data);
    }
  }
  
  onPageChange(data) {
    // Update the local UI
    this.ui.updatePageDisplay(data.currentPage, data.totalPages);
    
    // Sync the page change with the peer
    if (this.isConnected) {
      this.peer.sendData(JSON.stringify({
        type: 'page-change',
        pageIndex: this.whiteboard.currentPageIndex,
      }));
    }
  }

  onDataReceived(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      switch (data.type) {
        case 'canvas-change':
          // Handles shapes, text, and modifications
          this.whiteboard.updateFromData(data);
          break;
        case 'page-change':
          // Go to the specified page without sending a callback
          if (data.pageIndex !== undefined) {
            this.whiteboard.goToPage(data.pageIndex, true);
          }
          break;
        case 'continuous-drawing':
          // Handles the real-time pencil/eraser drawing
          this.whiteboard.receiveContinuousDrawing(data);
          break;
        default:
          console.log('Unknown data type received:', data.type);
      }
    } catch (error) {
      console.error('Error parsing received data:', error, jsonData);
    }
  }

  syncWhiteboard() {
    // Send the full current page data to the new peer
    const fullCanvasData = {
      type: 'canvas-change',
      pageIndex: this.whiteboard.currentPageIndex,
      pageData: JSON.stringify(this.whiteboard.canvas)
    };
    this.peer.sendData(JSON.stringify(fullCanvasData));
  }

  // Page Controls
  clearCurrentPage() {
    this.whiteboard.clearCurrentPage();
  }

  addPage() {
    this.whiteboard.addNewPage();
  }

  deletePage() {
    if (this.whiteboard.pages.length > 1) {
      this.whiteboard.deletePage(this.whiteboard.currentPageIndex);
    } else {
        alert("Cannot delete the last page.");
    }
  }

  prevPage() {
    this.whiteboard.goToPage(this.whiteboard.currentPageIndex - 1);
  }

  nextPage() {
    this.whiteboard.goToPage(this.whiteboard.currentPageIndex + 1);
  }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Whiteboard App...');
  window.app = new WhiteboardApp();
  console.log('Whiteboard App initialized successfully');
});
