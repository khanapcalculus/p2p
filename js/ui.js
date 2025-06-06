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
      clearCanvas: document.getElementById('clear-canvas'),
      colorSelector: document.getElementById('color-selector'),
      brushSize: document.getElementById('brush-size')
    };
    
    this.toolButtons = [
      this.elements.pencilTool,
      this.elements.lineTool,
      this.elements.rectTool,
      this.elements.circleTool,
      this.elements.textTool,
      this.elements.eraserTool
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
  }

  setupEventListeners() {
    // Tool selection
    this.toolButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.setActiveTool(button);
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
      if (this.onBrushSizeChange) {
        this.onBrushSizeChange(parseInt(this.elements.brushSize.value));
      }
    });
    
    // Clear canvas
    this.elements.clearCanvas.addEventListener('click', () => {
      if (this.onClearCanvas) {
        this.onClearCanvas();
      }
    });
    
    // Video controls
    this.elements.toggleVideoBtn.addEventListener('click', () => {
      if (this.onToggleVideo) {
        const enabled = this.onToggleVideo();
        this.elements.toggleVideoBtn.textContent = enabled ? 'Disable Video' : 'Enable Video';
      }
    });
    
    this.elements.toggleAudioBtn.addEventListener('click', () => {
      if (this.onToggleAudio) {
        const enabled = this.onToggleAudio();
        this.elements.toggleAudioBtn.textContent = enabled ? 'Mute Audio' : 'Unmute Audio';
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

  updateStatus(message) {
    this.elements.statusMessage.textContent = message;
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
      onJoinRoom
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
  }
}