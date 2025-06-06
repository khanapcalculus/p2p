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
    this.whiteboard.setPagesChangeCallback((data) => this.onPagesChange(data));
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

    // Initialize signaling
    this.peer.initializeSignaling('https://serverp2p.onrender.com');
  }

  async createRoom(roomId, userName, userRole) {
    try {
      // Special instruction for tablets
      if (this.isTabletDevice()) {
        this.ui.updateStatus('📱 <strong>Tablet Users:</strong> Please close any notification bubbles, overlays, or popup windows from other apps before allowing camera access.', 'info');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Give user time to read
      }
      
      this.ui.updateStatus('Setting up camera and microphone...');
      
      // Get local media stream with retries for tablets
      await this.attemptMediaAccess();
      
      // Join the room
      this.peer.joinRoom(roomId, `${userName} (${userRole})`);
      
    } catch (error) {
      console.error('Error creating room:', error);
      this.ui.updateStatus('Error creating room - continuing without media');
      // Still try to join the room even without media
      this.peer.joinRoom(roomId, `${userName} (${userRole})`);
    }
  }

  async joinRoom(roomId, userName, userRole) {
    try {
      // Special instruction for tablets
      if (this.isTabletDevice()) {
        this.ui.updateStatus('📱 <strong>Tablet Users:</strong> Please close any notification bubbles, overlays, or popup windows from other apps before allowing camera access.', 'info');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Give user time to read
      }
      
      this.ui.updateStatus('Setting up camera and microphone...');
      
      // Get local media stream with retries for tablets
      await this.attemptMediaAccess();
      
      // Join the room
      this.peer.joinRoom(roomId, `${userName} (${userRole})`);
      
    } catch (error) {
      console.error('Error joining room:', error);
      this.ui.updateStatus('Error joining room - continuing without media');
      // Still try to join the room even without media
      this.peer.joinRoom(roomId, `${userName} (${userRole})`);
    }
  }

  async attemptMediaAccess() {
    try {
      // For tablets, we might need to request media access with user gesture
      console.log('Attempting media access...');
      
      // First attempt
      const stream = await this.peer.getLocalStream(true, true);
      if (stream) {
        this.ui.setLocalStream(stream);
        return stream;
      }
      
      // If no stream, inform user and continue
      console.log('No media stream obtained - continuing without media');
      this.ui.updateStatus('📱 Camera/microphone not available. Click "🔄 Retry Camera" to try again.', 'warning');
      return null;
      
    } catch (error) {
      console.error('Media access failed:', error);
      
      // On tablets, sometimes a second attempt after user interaction works
      this.ui.updateStatus('📱 Camera access failed on first try. This is common on tablets.<br/>Click "🔄 Retry Camera" to try again.', 'warning');
      return null;
    }
  }

  async retryMediaAccess() {
    this.ui.updateStatus('🔄 Retrying camera and microphone access...', 'info');
    
    try {
      // On tablets, try with a slight delay to ensure user gesture is processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stream = await this.peer.getLocalStream(true, true);
      if (stream) {
        this.ui.setLocalStream(stream);
        this.ui.updateStatus('✅ Camera and microphone access successful!', 'success');
        
        // Ensure media is properly connected to peer if connected
        if (this.peer.peer && this.peer.peer.connectionState === 'connected') {
          this.peer.ensureMediaConnection();
          this.ui.updateStatus('📹🎤 Media connected to peer successfully!', 'success');
        }
        
        return true;
      } else {
        this.ui.updateStatus('⚠️ Camera/microphone access failed.<br/>Please check your device permissions and try again.<br/>The whiteboard works without media.', 'warning');
        return false;
      }
    } catch (error) {
      console.error('Retry media access failed:', error);
      this.ui.updateStatus(`❌ Camera access failed: ${error.message}<br/>Please check browser permissions in Settings.`, 'error');
      return false;
    }
  }

  onPeerConnected() {
    this.isConnected = true;
    this.ui.updateStatus('Connected to peer - Ready to collaborate!');
    
    // Send current whiteboard state to new peer
    this.syncWhiteboard();
  }

  onPeerDisconnected() {
    this.isConnected = false;
    this.ui.updateStatus('Peer disconnected');
  }

  onCanvasChange(data) {
    if (this.isConnected) {
      this.peer.sendData(JSON.stringify({
        type: 'canvas-change',
        ...data
      }));
    }
  }

  onPagesChange(data) {
    if (this.isConnected) {
      this.peer.sendData(JSON.stringify({
        type: 'pages-structure',
        ...data
      }));
    }
  }

  onPageChange(data) {
    if (this.isConnected) {
      this.peer.sendData(JSON.stringify({
        type: 'page-change',
        ...data
      }));
      
      // Update UI
      this.ui.updatePageDisplay(data.currentPage + 1, data.totalPages);
    } else {
      // Update UI locally if not connected
      this.ui.updatePageDisplay(data.currentPage + 1, data.totalPages);
    }
  }

  onContinuousDrawing(data) {
    if (this.isConnected) {
      this.peer.sendContinuousDrawing(data);
    }
  }

  onDataReceived(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      switch (data.type) {
        case 'canvas-change':
          this.whiteboard.updateFromData(data);
          break;
        case 'pages-structure':
          if (data.totalPages !== undefined) {
            this.whiteboard.syncPageStructure(data);
            this.ui.updatePageDisplay(this.whiteboard.currentPageIndex + 1, this.whiteboard.pages.length);
          }
          break;
        case 'page-change':
          if (data.pageIndex !== undefined) {
            this.whiteboard.goToPage(data.pageIndex);
            // Update UI with current whiteboard state
            this.ui.updatePageDisplay(this.whiteboard.currentPageIndex + 1, this.whiteboard.pages.length);
          }
          break;
        case 'continuous-drawing':
          this.whiteboard.receiveContinuousDrawing(data);
          break;
        default:
          console.log('Unknown data type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing received data:', error);
    }
  }

  syncWhiteboard() {
    // Send current page structure
    const pagesData = {
      type: 'pages-structure',
      pageStructure: this.whiteboard.getPageStructure(),
      currentPageIndex: this.whiteboard.currentPageIndex
    };
    this.peer.sendData(JSON.stringify(pagesData));

    // Send current page data
    const currentPageData = {
      type: 'canvas-change',
      pageData: JSON.stringify(this.whiteboard.canvas),
      pageIndex: this.whiteboard.currentPageIndex
    };
    this.peer.sendData(JSON.stringify(currentPageData));
  }

  clearCurrentPage() {
    this.whiteboard.clearCurrentPage();
  }

  addPage() {
    this.whiteboard.addNewPage();
  }

  deletePage() {
    if (this.whiteboard.pages.length > 1) {
      this.whiteboard.deletePage(this.whiteboard.currentPageIndex);
    }
  }

  prevPage() {
    if (this.whiteboard.currentPageIndex > 0) {
      this.whiteboard.goToPage(this.whiteboard.currentPageIndex - 1);
    }
  }

  nextPage() {
    if (this.whiteboard.currentPageIndex < this.whiteboard.pages.length - 1) {
      this.whiteboard.goToPage(this.whiteboard.currentPageIndex + 1);
    }
  }

  // Detect if device is likely a tablet
  isTabletDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    return /iPad|Android/i.test(userAgent) && 'ontouchstart' in window;
  }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Whiteboard App...');
  window.app = new WhiteboardApp();
  console.log('Whiteboard App initialized successfully');
});