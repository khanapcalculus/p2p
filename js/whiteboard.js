class Whiteboard {
  constructor() {
    this.canvas = new fabric.Canvas('whiteboard');
    this.isDrawing = false;
    this.currentTool = 'pencil';
    this.color = '#000000';
    this.brushSize = 3;
    this.pages = [];
    this.currentPageIndex = 0;
    this.changeTimeout = null; // For debouncing changes
    this.drawingBuffer = []; // For continuous drawing
    this.initialize();
  }

  initialize() {
    // Set up canvas with exact sizing
    this.setupCanvas();
    
    // Create first page
    this.addNewPage();
    
    // Initialize drawing mode
    this.setTool('pencil');

    // Setup event listeners for canvas events
    this.setupCanvasEvents();
    
    // Listen for window resize
    window.addEventListener('resize', () => this.handleResize());
  }

  handleResize() {
    // Update canvas size on window resize
    this.setupCanvas();
  }

  setupCanvas() {
    // Calculate exact canvas dimensions with floating panels
    const headerHeight = 60; // Header height
    const bottomHeight = 60; // Bottom panel height
    
    // Full workspace dimensions (floating panels don't take space)
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight - headerHeight - bottomHeight;
    
    // Canvas dimensions (height is double the width for more vertical workspace)
    const canvasWidth = 1000;
    const canvasHeight = canvasWidth * 2; // Height is double the width
    
    console.log('Canvas dimensions:', canvasWidth, 'x', canvasHeight);
    console.log('Container dimensions:', containerWidth, 'x', containerHeight);
    
    // Get canvas container and set exact dimensions
    const canvasContainer = document.getElementById('whiteboard').parentElement;
    
    // Remove all margins and padding, set exact container size
    canvasContainer.style.width = `${containerWidth}px`;
    canvasContainer.style.height = `${containerHeight}px`;
    canvasContainer.style.overflow = 'auto'; // Enable scrollbars always
    canvasContainer.style.overflowX = 'auto'; // Horizontal scrollbar
    canvasContainer.style.overflowY = 'auto'; // Vertical scrollbar
    canvasContainer.style.position = 'relative';
    canvasContainer.style.margin = '0';
    canvasContainer.style.padding = '0';
    canvasContainer.style.border = 'none';
    canvasContainer.style.webkitOverflowScrolling = 'touch'; // Smooth scrolling on iOS
    
    // Set canvas dimensions
    this.canvas.setWidth(canvasWidth);
    this.canvas.setHeight(canvasHeight);
    
    // Set canvas element style to remove any margins/padding
    const canvasElement = document.getElementById('whiteboard');
    canvasElement.style.margin = '0';
    canvasElement.style.padding = '0';
    canvasElement.style.border = 'none';
    canvasElement.style.display = 'block';
    
    // Set canvas element to exact size (no CSS scaling)
    this.canvas.setDimensions({
      width: canvasWidth,
      height: canvasHeight
    }, { cssOnly: false });
    
    // Performance optimizations
    this.canvas.renderOnAddRemove = false;
    this.canvas.skipOffscreen = true;
    
    // Enable touch scrolling for tablets
    this.canvas.allowTouchScrolling = true;
    
    this.canvas.renderAll();
  }

  addNewPage() {
    const pageNumber = this.pages.length + 1;
    const newPage = {
      id: `page-${pageNumber}`,
      number: pageNumber,
      data: null,
      title: `Page ${pageNumber}`
    };
    
    this.pages.push(newPage);
    this.currentPageIndex = this.pages.length - 1;
    
    // Load the new page without triggering page change callback to prevent loops
    this.loadPage(this.currentPageIndex, false);
    
    // Notify about page structure change
    if (typeof this.onPagesChange === 'function') {
      this.onPagesChange(this.getPageStructure());
    }
    
    // Send a single page change notification for the new page
    if (typeof this.onPageChange === 'function') {
      this.onPageChange({
        pageIndex: this.currentPageIndex,
        currentPage: this.currentPageIndex,
        totalPages: this.pages.length,
        page: newPage
      });
    }
    
    return newPage;
  }

  deletePage(pageIndex) {
    if (this.pages.length <= 1) {
      alert('Cannot delete the last page!');
      return false;
    }
    
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      return false;
    }
    
    // Save current page before deleting
    this.saveCurrentPage();
    
    // Remove page
    this.pages.splice(pageIndex, 1);
    
    // Renumber pages
    this.pages.forEach((page, index) => {
      page.number = index + 1;
      page.title = `Page ${index + 1}`;
    });
    
    // Adjust current page index
    if (this.currentPageIndex >= this.pages.length) {
      this.currentPageIndex = this.pages.length - 1;
    } else if (this.currentPageIndex > pageIndex) {
      this.currentPageIndex--;
    }
    
    // Load appropriate page
    this.loadPage(this.currentPageIndex);
    
    // Notify about page structure change
    if (typeof this.onPagesChange === 'function') {
      this.onPagesChange(this.getPageStructure());
    }
    
    return true;
  }

  goToPage(pageIndex, skipCallback = false) {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      return false;
    }
    
    // Save current page
    this.saveCurrentPage();
    
    // Load new page
    this.currentPageIndex = pageIndex;
    this.loadPage(pageIndex, skipCallback);
    
    return true;
  }

  saveCurrentPage() {
    if (this.currentPageIndex >= 0 && this.currentPageIndex < this.pages.length) {
      this.pages[this.currentPageIndex].data = JSON.stringify(this.canvas);
    }
  }

  loadPage(pageIndex, skipCallback = false) {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      return;
    }
    
    const page = this.pages[pageIndex];
    
    // Ensure page has data property
    if (!page.hasOwnProperty('data')) {
      page.data = null;
    }
    
    if (page.data) {
      // Load existing page data
      this.canvas.loadFromJSON(page.data, () => {
        this.canvas.renderAll();
      });
    } else {
      // Clear canvas for new page
      this.canvas.clear();
    }
    
    // Update page display
    this.updatePageDisplay();
    
    // Only emit page change if not skipping callback (prevents infinite loops)
    if (!skipCallback && typeof this.onPageChange === 'function') {
      this.onPageChange({
        pageIndex: pageIndex,
        currentPage: this.currentPageIndex,
        totalPages: this.pages.length,
        page: page
      });
    }
  }

  updatePageDisplay() {
    const pageDisplay = document.getElementById('current-page-display');
    if (pageDisplay && this.pages[this.currentPageIndex]) {
      pageDisplay.textContent = `Page ${this.currentPageIndex + 1} of ${this.pages.length}`;
    }
  }

  getPageStructure() {
    return {
      pages: this.pages.map(page => ({
        id: page.id,
        number: page.number,
        title: page.title
      })),
      currentPageIndex: this.currentPageIndex,
      totalPages: this.pages.length
    };
  }

  setTool(tool) {
    this.currentTool = tool;
    
    // Clear selection
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
    
    // Configure canvas based on tool (removed pan tool)
    switch (tool) {
      case 'pencil':
        this.canvas.isDrawingMode = true;
        this.canvas.freeDrawingBrush.color = this.color;
        this.canvas.freeDrawingBrush.width = this.brushSize;
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'crosshair';
        break;
      case 'eraser':
        this.canvas.isDrawingMode = true;
        this.canvas.freeDrawingBrush.color = 'white';
        this.canvas.freeDrawingBrush.width = this.brushSize * 2;
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'crosshair';
        break;
      default:
        // For line, rect, circle, text tools
        this.canvas.isDrawingMode = false;
        this.canvas.selection = true;
        this.canvas.defaultCursor = 'crosshair';
        break;
    }
  }

  setColor(color) {
    this.color = color;
    if (this.currentTool === 'pencil') {
      this.canvas.freeDrawingBrush.color = color;
    }
  }

  setBrushSize(size) {
    this.brushSize = size;
    if (this.currentTool === 'pencil') {
      this.canvas.freeDrawingBrush.width = size;
    } else if (this.currentTool === 'eraser') {
      this.canvas.freeDrawingBrush.width = size * 2;
    }
  }

  // Continuous drawing synchronization
  sendContinuousDrawing(type, data) {
    if (typeof this.onContinuousDrawing === 'function') {
      this.onContinuousDrawing({
        type: type, // 'start', 'move', 'end'
        data: data,
        pageIndex: this.currentPageIndex,
        tool: this.currentTool,
        color: this.color,
        brushSize: this.brushSize,
        timestamp: Date.now()
      });
    }
  }

  // Handle received continuous drawing
  receiveContinuousDrawing(drawingData) {
    if (drawingData.pageIndex !== this.currentPageIndex) return;
    
    // Apply the drawing data in real-time
    switch (drawingData.type) {
      case 'start':
        // Start a new drawing path
        this.remoteDrawingPath = new fabric.Path('', {
          stroke: drawingData.color,
          strokeWidth: drawingData.brushSize,
          fill: '',
          selectable: false
        });
        break;
      case 'move':
        // Update the drawing path
        if (this.remoteDrawingPath && drawingData.data) {
          // Update path data for continuous drawing
          this.updateRemoteDrawingPath(drawingData.data);
        }
        break;
      case 'end':
        // Finalize the drawing
        if (this.remoteDrawingPath) {
          this.canvas.add(this.remoteDrawingPath);
          this.canvas.renderAll();
          this.remoteDrawingPath = null;
        }
        break;
    }
  }

  updateRemoteDrawingPath(pathData) {
    // This would need to be implemented based on the specific path format
    // For now, we'll use the debounced update system
    this.notifyChange();
  }

  // Debounced change notification
  notifyChange() {
    if (this.changeTimeout) {
      clearTimeout(this.changeTimeout);
    }
    
    this.changeTimeout = setTimeout(() => {
      this.saveCurrentPage();
      if (typeof this.onCanvasChange === 'function') {
        this.onCanvasChange({
          pageIndex: this.currentPageIndex,
          pageData: JSON.stringify(this.canvas),
          pageStructure: this.getPageStructure()
        });
      }
    }, 50); // Reduced debounce for more responsive updates
  }

  setupCanvasEvents() {
    let startPoint;
    let shape;
    let isDrawingPath = false;

    this.canvas.on('mouse:down', (options) => {
      if (this.currentTool === 'pencil' || this.currentTool === 'eraser') {
        isDrawingPath = true;
        const pointer = this.canvas.getPointer(options.e);
        this.sendContinuousDrawing('start', { x: pointer.x, y: pointer.y });
        return;
      }

      this.isDrawing = true;
      startPoint = this.canvas.getPointer(options.e);

      switch (this.currentTool) {
        case 'line':
          shape = new fabric.Line(
            [startPoint.x, startPoint.y, startPoint.x, startPoint.y],
            {
              stroke: this.color,
              strokeWidth: this.brushSize,
              selectable: true
            }
          );
          break;
        case 'rect':
          shape = new fabric.Rect({
            left: startPoint.x,
            top: startPoint.y,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: this.color,
            strokeWidth: this.brushSize,
            selectable: true
          });
          break;
        case 'circle':
          shape = new fabric.Circle({
            left: startPoint.x,
            top: startPoint.y,
            radius: 0,
            fill: 'transparent',
            stroke: this.color,
            strokeWidth: this.brushSize,
            selectable: true
          });
          break;
        case 'text':
          shape = new fabric.IText('Text', {
            left: startPoint.x,
            top: startPoint.y,
            fontFamily: 'Arial',
            fill: this.color,
            fontSize: this.brushSize * 5,
            selectable: true,
            editable: true
          });
          this.canvas.add(shape);
          this.canvas.setActiveObject(shape);
          shape.enterEditing();
          shape.selectAll();
          this.canvas.renderAll();
          break;
      }

      if (this.currentTool !== 'text' && shape) {
        this.canvas.add(shape);
        this.canvas.renderAll();
      }
    });

    this.canvas.on('mouse:move', (options) => {
      // Send continuous drawing data for pencil/eraser
      if (isDrawingPath && (this.currentTool === 'pencil' || this.currentTool === 'eraser')) {
        const pointer = this.canvas.getPointer(options.e);
        this.sendContinuousDrawing('move', { x: pointer.x, y: pointer.y });
      }
      
      if (!this.isDrawing || this.currentTool === 'text') return;

      const pointer = this.canvas.getPointer(options.e);

      switch (this.currentTool) {
        case 'line':
          shape.set({ x2: pointer.x, y2: pointer.y });
          break;
        case 'rect':
          if (startPoint.x > pointer.x) {
            shape.set({ left: pointer.x });
          }
          if (startPoint.y > pointer.y) {
            shape.set({ top: pointer.y });
          }
          shape.set({
            width: Math.abs(startPoint.x - pointer.x),
            height: Math.abs(startPoint.y - pointer.y)
          });
          break;
        case 'circle':
          const radius = Math.sqrt(
            Math.pow(startPoint.x - pointer.x, 2) +
            Math.pow(startPoint.y - pointer.y, 2)
          ) / 2;
          shape.set({ radius: radius });
          break;
      }

      this.canvas.requestRenderAll();
    });

    this.canvas.on('mouse:up', () => {
      // End continuous drawing
      if (isDrawingPath && (this.currentTool === 'pencil' || this.currentTool === 'eraser')) {
        this.sendContinuousDrawing('end', {});
        isDrawingPath = false;
      }
      
      this.isDrawing = false;
      this.canvas.renderAll();
      
      this.notifyChange();
    });

    // Handle drawing completion
    this.canvas.on('path:created', () => {
      this.notifyChange();
    });

    this.canvas.on('object:modified', () => {
      this.notifyChange();
    });
  }

  clearCurrentPage() {
    this.canvas.clear();
    this.saveCurrentPage();
    if (typeof this.onCanvasChange === 'function') {
      this.onCanvasChange({
        pageIndex: this.currentPageIndex,
        pageData: JSON.stringify(this.canvas),
        pageStructure: this.getPageStructure()
      });
    }
  }

  // Method to update from received data
  updateFromData(data) {
    if (data.pageIndex !== undefined && data.pageData) {
      // Update specific page
      if (data.pageIndex >= 0 && data.pageIndex < this.pages.length) {
        this.pages[data.pageIndex].data = data.pageData;
        
        // If it's the current page, reload it
        if (data.pageIndex === this.currentPageIndex) {
          this.canvas.loadFromJSON(data.pageData, () => {
            this.canvas.renderAll();
          });
        }
      }
    }
    
    // Update page structure if provided
    if (data.pageStructure) {
      this.syncPageStructure(data.pageStructure);
    }
  }

  syncPageStructure(remoteStructure) {
    // Add missing pages
    while (this.pages.length < remoteStructure.totalPages) {
      const pageNumber = this.pages.length + 1;
      const newPage = {
        id: `page-${pageNumber}`,
        number: pageNumber,
        data: null, // Ensure data property exists
        title: `Page ${pageNumber}`
      };
      this.pages.push(newPage);
    }
    
    // Update page display
    this.updatePageDisplay();
  }

  // Set callbacks
  setChangeCallback(callback) {
    this.onCanvasChange = callback;
  }

  setPagesChangeCallback(callback) {
    this.onPagesChange = callback;
  }

  setPageChangeCallback(callback) {
    this.onPageChange = callback;
  }

  setContinuousDrawingCallback(callback) {
    this.onContinuousDrawing = callback;
  }
}