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

    // This will hold temporary paths being drawn by the remote user
    this.remoteDrawingPaths = {};

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
    const canvasHeight = 1000; // Height is double the width
    
    // Get canvas container and set exact dimensions
    const canvasContainer = document.getElementById('whiteboard').parentElement;
    
    // Remove all margins and padding, set exact container size
    canvasContainer.style.width = `${containerWidth}px`;
    canvasContainer.style.height = `${containerHeight}px`;
    canvasContainer.style.overflow = 'auto'; // Enable scrollbars always
    canvasContainer.style.webkitOverflowScrolling = 'touch'; // Smooth scrolling on iOS
    
    // Set canvas dimensions
    this.canvas.setWidth(canvasWidth);
    this.canvas.setHeight(canvasHeight);
    
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
    if (typeof this.onPageChange === 'function' && !skipCallback) {
      this.onPageChange({
        pageIndex: pageIndex,
        currentPage: this.currentPageIndex,
        totalPages: this.pages.length,
        page: page
      });
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
    
    switch (tool) {
      case 'pencil':
        this.canvas.isDrawingMode = true;
        this.canvas.freeDrawingBrush.color = this.color;
        this.canvas.freeDrawingBrush.width = this.brushSize;
        this.canvas.selection = false;
        break;
      case 'eraser':
        this.canvas.isDrawingMode = true;
        this.canvas.freeDrawingBrush.color = '#FFFFFF'; // Eraser is just a white brush
        this.canvas.freeDrawingBrush.width = this.brushSize * 2;
        this.canvas.selection = false;
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

  // Handle received continuous drawing
  receiveContinuousDrawing(drawingData) {
    if (drawingData.pageIndex !== this.currentPageIndex) return;

    const pathId = drawingData.id;

    switch (drawingData.type) {
        case 'start':
            // Create a new path object when the remote user starts drawing
            const path = new fabric.Path(`M ${drawingData.data[1]} ${drawingData.data[2]}`, {
                stroke: drawingData.color,
                strokeWidth: drawingData.brushSize,
                fill: null,
                strokeLineCap: 'round',
                strokeLineJoin: 'round',
                selectable: false,
                evented: false,
                objectCaching: false, // Important for live drawing performance
            });
            this.remoteDrawingPaths[pathId] = path;
            this.canvas.add(path);
            break;

        case 'move':
            const existingPath = this.remoteDrawingPaths[pathId];
            if (existingPath && drawingData.data) {
                // Add the new point to the path data array
                existingPath.path.push(drawingData.data);
                this.canvas.requestRenderAll();
            }
            break;

        case 'end':
            const finalPath = this.remoteDrawingPaths[pathId];
            if (finalPath) {
                // Finalize the path by enabling caching for performance
                finalPath.set({
                    objectCaching: true,
                });
                delete this.remoteDrawingPaths[pathId];
                this.canvas.requestRenderAll();
                // Trigger a debounced save/sync to ensure eventual consistency
                this.notifyChange();
            }
            break;
    }
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
          pageData: JSON.stringify(this.canvas)
        });
      }
    }, 200); // Increased debounce to reduce frequency
  }

  setupCanvasEvents() {
    let startPoint;
    let shape;

    // These are no longer needed here as isDrawingMode handles it
    // let isDrawingPath = false;

    this.canvas.on('mouse:down', (options) => {
      // For non-pencil/eraser tools
      if (this.currentTool === 'pencil' || this.currentTool === 'eraser') {
          return; // Fabric's isDrawingMode will handle this
      }

      this.isDrawing = true;
      startPoint = this.canvas.getPointer(options.e);

      switch (this.currentTool) {
        case 'line':
          shape = new fabric.Line(
            [startPoint.x, startPoint.y, startPoint.x, startPoint.y], { stroke: this.color, strokeWidth: this.brushSize, selectable: true }
          );
          break;
        case 'rect':
          shape = new fabric.Rect({
            left: startPoint.x, top: startPoint.y, width: 0, height: 0, fill: 'transparent', stroke: this.color, strokeWidth: this.brushSize, selectable: true
          });
          break;
        case 'circle':
          shape = new fabric.Circle({
            left: startPoint.x, top: startPoint.y, radius: 0, fill: 'transparent', stroke: this.color, strokeWidth: this.brushSize, selectable: true
          });
          break;
        case 'text':
          shape = new fabric.IText('Text', {
            left: startPoint.x, top: startPoint.y, fontFamily: 'Arial', fill: this.color, fontSize: this.brushSize * 5, selectable: true, editable: true
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
      if (this.currentTool === 'pencil' || this.currentTool === 'eraser') {
          return;
      }

      if (!this.isDrawing || !shape) return;

      const pointer = this.canvas.getPointer(options.e);
      switch (this.currentTool) {
        case 'line':
          shape.set({ x2: pointer.x, y2: pointer.y });
          break;
        case 'rect':
          shape.set({
              width: Math.abs(startPoint.x - pointer.x),
              height: Math.abs(startPoint.y - pointer.y),
              left: startPoint.x > pointer.x ? pointer.x : startPoint.x,
              top: startPoint.y > pointer.y ? pointer.y : startPoint.y
          });
          break;
        case 'circle':
          const radius = Math.sqrt(Math.pow(startPoint.x - pointer.x, 2) + Math.pow(startPoint.y - pointer.y, 2)) / 2;
          shape.set({
              radius: radius,
              left: startPoint.x > pointer.x ? pointer.x + radius : startPoint.x - radius,
              top: startPoint.y > pointer.y ? pointer.y + radius : startPoint.y - radius
          });
          break;
      }
      this.canvas.requestRenderAll();
    });

    this.canvas.on('mouse:up', () => {
      if (this.currentTool === 'pencil' || this.currentTool === 'eraser') {
          return;
      }
      
      this.isDrawing = false;
      if (shape) {
        this.notifyChange();
        shape = null;
      }
    });

    // This event fires for both local and remote path creation when using isDrawingMode.
    // It's the key to our performance improvement.
    this.canvas.on('path:created', (e) => {
        // This path was created locally. We must send its data to the peer.
        // We will send the full path data as a single event.
        // This is much better than sending the entire canvas JSON.
        if (this.onContinuousDrawing) {
            // Send the entire path data in one go
            const pathData = e.path.toJSON();
            this.onContinuousDrawing({ type: 'path-created', data: pathData, pageIndex: this.currentPageIndex });
        }
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
      });
    }
  }

  updateFromData(data) {
    if (data.pageIndex !== undefined && data.pageData) {
      if (data.pageIndex >= 0 && data.pageIndex < this.pages.length) {
        this.pages[data.pageIndex].data = data.pageData;
        
        if (data.pageIndex === this.currentPageIndex) {
          this.canvas.loadFromJSON(data.pageData, () => {
            this.canvas.renderAll();
          });
        }
      }
    }
  }

  syncPageStructure(remoteStructure) {
    // Add missing pages
    while (this.pages.length < remoteStructure.totalPages) {
      const pageNumber = this.pages.length + 1;
      const newPage = {
        id: `page-${pageNumber}`, number: pageNumber, data: null, title: `Page ${pageNumber}`
      };
      this.pages.push(newPage);
    }
    
    // Update page display locally
    if (this.onPageChange) {
        this.onPageChange({
            currentPage: this.currentPageIndex,
            totalPages: this.pages.length,
        });
    }
  }
  
  // Set callbacks
  setChangeCallback(callback) { this.onCanvasChange = callback; }
  setPagesChangeCallback(callback) { this.onPagesChange = callback; }
  setPageChangeCallback(callback) { this.onPageChange = callback; }
  setContinuousDrawingCallback(callback) { this.onContinuousDrawing = callback; }
}
