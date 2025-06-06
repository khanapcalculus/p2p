class UI {
  constructor() {
    this.elements = {
      roomId: document.getElementById('room-id'),
      userName: document.getElementById('user-name'),
      userRole: document.getElementById('user-role'),
      createBtn: document.getElementById('create-btn'),
      joinBtn: document.getElementById('join-btn'),
      localVideo: document.getElementById('local-video'),
      remoteVideo: document.getElementById('remote-video'),
      toggleVideoBtn: document.getElementById('toggle-video'),
      toggleAudioBtn: document.getElementById('toggle-audio'),
      shareScreenBtn: document.getElementById('share-screen'),
      statusMessage: document.getElementById('status-message'),
      pencilTool: document.getElementById('pencil-tool'),
      lineTool: document.getElementById('line-tool'),
      rectTool: document.getElementById('rect-tool'),
      circleTool: document.getElementById('circle-tool'),
      textTool: document.getElementById('text-tool'),
      eraserTool: document.getElementById('eraser-tool'),
      panTool: document.getElementById('pan-tool'),
      clearCanvas: document.getElementById('clear-canvas'),
      colorSelector: document.getElementById('color-selector'),
      brushSize: document.getElementById('brush-size'),
      brushSizeDisplay: document.getElementById('brush-size-display'),
      currentPageDisplay: document.getElementById('current-page-display'),
      addPageBtn: document.getElementById('add-page-btn'),
      deletePageBtn: document.getElementById('delete-page-btn'),
      prevPageBtn: document.getElementById('prev-page-btn'),
      nextPageBtn: document.getElementById('next-page-btn'),
      cameraSmall: document.getElementById('camera-small'),
      cameraMedium: document.getElementById('camera-medium'),
      cameraLarge: document.getElementById('camera-large'),
      cameraSection: document.querySelector('.camera-section')
    };
    
    this.toolButtons = [
      this.elements.pencilTool,
      this.elements.lineTool,
      this.elements.rectTool,
      this.elements.circleTool,
      this.elements.textTool,
      this.elements.eraserTool,
      this.elements.panTool
    ];
    
    this.cameraSizeButtons = [
      this.elements.cameraSmall,
      this.elements.cameraMedium,
      this.elements.cameraLarge
    ];
    
    this.initialize();
  }

  initialize() {
    // Generate a random room ID if not provided
    if (!this.elements.roomId.value) {
      this.elements.roomId.value = this.generateRoomId();
    }
    
    // Set up event listeners for UI controls
    this.setupEventListeners();
    
    // Initialize brush size display
    this.updateBrushSizeDisplay();
  }

  setupEventListeners() {
    // Tool selection
    this.toolButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.setActiveTool(button);
      });
    });
    
    // Camera size controls
    this.cameraSizeButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.setCameraSize(button);
      });
    });
    
    // Color selection
    this.elements.colorSelector.addEventListener('change', () => {
      if (this.onColorChange) {
        this.onColorChange(this.elements.colorSelector.value);
      }
    });
    
    // Brush size
    this.elements.brushSize.addEventListener('input', () => {
      const size = parseInt(this.elements.brushSize.value);
      this.updateBrushSizeDisplay();
      if (this.onBrushSizeChange) {
        this.onBrushSizeChange(size);
      }
    });
    
    // Clear canvas
    this.elements.clearCanvas.addEventListener('click', () => {
      if (this.onClearCanvas) {
        this.onClearCanvas();
      }
    });
    
    // Page controls
    if (this.elements.addPageBtn) {
      this.elements.addPageBtn.addEventListener('click', () => {
        if (this.onAddPage) {
          this.onAddPage();
        }
      });
    }
    
    if (this.elements.deletePageBtn) {
      this.elements.deletePageBtn.addEventListener('click', () => {
        if (this.onDeletePage) {
          this.onDeletePage();
        }
      });
    }
    
    if (this.elements.prevPageBtn) {
      this.elements.prevPageBtn.addEventListener('click', () => {
        if (this.onPrevPage) {
          this.onPrevPage();
        }
      });
    }
    
    if (this.elements.nextPageBtn) {
      this.elements.nextPageBtn.addEventListener('click', () => {
        if (this.onNextPage) {
          this.onNextPage();
        }
      });
    }
    
    // Video controls
    this.elements.toggleVideoBtn.addEventListener('click', () => {
      if (this.onToggleVideo) {
        const enabled = this.onToggleVideo();
        this.updateVideoButtonState(enabled);
      }
    });
    
    this.elements.toggleAudioBtn.addEventListener('click', () => {
      if (this.onToggleAudio) {
        const enabled = this.onToggleAudio();
        this.updateAudioButtonState(enabled);
      }
    });
    
    this.elements.shareScreenBtn.addEventListener('click', () => {
      if (this.onShareScreen) {
        this.onShareScreen();
      }
    });
    
    // Room controls
    this.elements.createBtn.addEventListener('click', () => {
      if (this.onCreateRoom) {
        this.onCreateRoom(this.elements.roomId.value, this.elements.userName.value, this.elements.userRole.value);
      }
    });
    
    this.elements.joinBtn.addEventListener('click', () => {
      if (this.onJoinRoom) {
        this.onJoinRoom(this.elements.roomId.value, this.elements.userName.value, this.elements.userRole.value);
      }
    });
  }

  setActiveTool(activeButton) {
    // Remove active class from all tool buttons
    this.toolButtons.forEach(button => {
      button.classList.remove('active');
    });
    
    // Add active class to the selected button
    activeButton.classList.add('active');
    
    // Call the callback with the tool name
    if (this.onToolChange) {
      const toolName = activeButton.id.replace('-tool', '');
      this.onToolChange(toolName);
    }
  }

  setCameraSize(activeButton) {
    // Remove active class from all camera size buttons
    this.cameraSizeButtons.forEach(button => {
      button.classList.remove('active');
    });
    
    // Add active class to the selected button
    activeButton.classList.add('active');
    
    // Remove existing size classes
    this.elements.cameraSection.classList.remove('camera-small', 'camera-medium', 'camera-large');
    
    // Add new size class
    const size = activeButton.id.replace('camera-', '');
    this.elements.cameraSection.classList.add(`camera-${size}`);
  }

  updateBrushSizeDisplay() {
    if (this.elements.brushSizeDisplay) {
      this.elements.brushSizeDisplay.textContent = this.elements.brushSize.value;
    }
  }

  updateStatus(message) {
    this.elements.statusMessage.textContent = message;
  }

  updatePageDisplay(currentPage, totalPages) {
    if (this.elements.currentPageDisplay) {
      this.elements.currentPageDisplay.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    // Update button states
    if (this.elements.prevPageBtn) {
      this.elements.prevPageBtn.disabled = currentPage <= 1;
    }
    
    if (this.elements.nextPageBtn) {
      this.elements.nextPageBtn.disabled = currentPage >= totalPages;
    }
    
    if (this.elements.deletePageBtn) {
      this.elements.deletePageBtn.disabled = totalPages <= 1;
    }
  }

  setLocalStream(stream) {
    this.elements.localVideo.srcObject = stream;
  }

  setRemoteStream(stream) {
    this.elements.remoteVideo.srcObject = stream;
  }

  generateRoomId() {
    return Math.random().toString(36).substring(2, 10);
  }

  // Set callbacks
  setCallbacks(callbacks) {
    const {
      onToolChange,
      onColorChange,
      onBrushSizeChange,
      onClearCanvas,
      onToggleVideo,
      onToggleAudio,
      onShareScreen,
      onCreateRoom,
      onJoinRoom,
      onAddPage,
      onDeletePage,
      onPrevPage,
      onNextPage
    } = callbacks;
    
    this.onToolChange = onToolChange;
    this.onColorChange = onColorChange;
    this.onBrushSizeChange = onBrushSizeChange;
    this.onClearCanvas = onClearCanvas;
    this.onToggleVideo = onToggleVideo;
    this.onToggleAudio = onToggleAudio;
    this.onShareScreen = onShareScreen;
    this.onCreateRoom = onCreateRoom;
    this.onJoinRoom = onJoinRoom;
    this.onAddPage = onAddPage;
    this.onDeletePage = onDeletePage;
    this.onPrevPage = onPrevPage;
    this.onNextPage = onNextPage;
  }

  updateVideoButtonState(enabled) {
    if (enabled) {
      this.elements.toggleVideoBtn.classList.add('active');
      this.elements.toggleVideoBtn.title = 'Disable Video';
    } else {
      this.elements.toggleVideoBtn.classList.remove('active');
      this.elements.toggleVideoBtn.title = 'Enable Video';
    }
  }

  updateAudioButtonState(enabled) {
    if (enabled) {
      this.elements.toggleAudioBtn.classList.add('active');
      this.elements.toggleAudioBtn.title = 'Mute Audio';
    } else {
      this.elements.toggleAudioBtn.classList.remove('active');
      this.elements.toggleAudioBtn.title = 'Unmute Audio';
    }
  }
}