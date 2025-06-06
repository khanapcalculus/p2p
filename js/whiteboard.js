class Whiteboard {
  constructor() {
    this.canvas = new fabric.Canvas('whiteboard');
    this.isDrawing = false;
    this.currentTool = 'pencil';
    this.color = '#000000';
    this.brushSize = 3;
    this.pages = [];
    this.currentPageIndex = 0;
    this.canvasSize = {
      width: 1000,
      height: 2000  // A4-like ratio but manageable size
    };
    this.initialize();
  }

  initialize() {
    // Set manageable canvas size
    this.setupCanvas();
    
    // Create first page
    this.addNewPage();
    
    // Initialize drawing mode
    this.setTool('pencil');

    // Setup event listeners for canvas events
    this.setupCanvasEvents();
  }

  setupCanvas() {
    // Set canvas to manageable size
    this.canvas.setWidth(this.canvasSize.width);
    this.canvas.setHeight(this.canvasSize.height);
    
    // Set viewport container
    const container = document.getElementById('whiteboard').parentElement;
    const viewportWidth = Math.min(container.clientWidth, this.canvasSize.width);
    const viewportHeight = Math.min(600, this.canvasSize.height);
    
    // Create viewport container
    const canvasContainer = document.getElementById('whiteboard').parentElement;
    canvasContainer.style.width = `${viewportWidth}px`;
    canvasContainer.style.height = `${viewportHeight}px`;
    canvasContainer.style.overflow = 'auto'; // Allow scrolling within page
    canvasContainer.style.position = 'relative';
    
    // Set canvas element size for viewport
    this.canvas.setDimensions({
      width: viewportWidth,
      height: viewportHeight
    }, { cssOnly: true });
    
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
    this.loadPage(this.currentPageIndex);
    
    // Notify about page structure change
    if (typeof this.onPagesChange === 'function') {
      this.onPagesChange(this.getPageStructure());
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

  goToPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      return false;
    }
    
    // Save current page
    this.saveCurrentPage();
    
    // Load new page
    this.currentPageIndex = pageIndex;
    this.loadPage(pageIndex);
    
    return true;
  }

  saveCurrentPage() {
    if (this.currentPageIndex >= 0 && this.currentPageIndex < this.pages.length) {
      this.pages[this.currentPageIndex].data = JSON.stringify(this.canvas);
    }
  }

  loadPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      return;
    }
    
    const page = this.pages[pageIndex];
    
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
    
    // Emit page change
    if (typeof this.onPageChange === 'function') {
      this.onPageChange(pageIndex, page);
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

    // Reset canvas mode
    this.canvas.isDrawingMode = false;

    switch (tool) {
      case 'pencil':
        this.canvas.isDrawingMode = true;
        this.canvas.freeDrawingBrush.color = this.color;
        this.canvas.freeDrawingBrush.width = this.brushSize;
        break;
      case 'eraser':
        this.canvas.isDrawingMode = true;
        this.canvas.freeDrawingBrush.color = '#ffffff';
        this.canvas.freeDrawingBrush.width = this.brushSize * 2;
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
    if (this.canvas.isDrawingMode) {
      this.canvas.freeDrawingBrush.width = this.currentTool === 'eraser' ? size * 2 : size;
    }
  }

  setupCanvasEvents() {
    let startPoint;
    let shape;

    this.canvas.on('mouse:down', (options) => {
      if (this.currentTool === 'pencil' || this.currentTool === 'eraser') return;

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
          break;
      }

      if (this.currentTool !== 'text') {
        this.canvas.add(shape);
      }
    });

    this.canvas.on('mouse:move', (options) => {
      if (!this.isDrawing || this.currentTool === 'text') return;

      const pointer = this.canvas.getPointer(options.e);

      switch (this.currentTool) {
        case 'line':
          shape.set({
            x2: pointer.x,
            y2: pointer.y
          });
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
          shape.set({
            radius: radius
          });
          break;
      }

      this.canvas.renderAll();
    });

    this.canvas.on('mouse:up', () => {
      this.isDrawing = false;
      this.canvas.renderAll();
      
      // Auto-save current page and emit changes
      this.saveCurrentPage();
      if (typeof this.onCanvasChange === 'function') {
        this.onCanvasChange({
          pageIndex: this.currentPageIndex,
          pageData: JSON.stringify(this.canvas),
          pageStructure: this.getPageStructure()
        });
      }
    });

    // Handle object modifications
    this.canvas.on('object:modified', () => {
      this.saveCurrentPage();
      if (typeof this.onCanvasChange === 'function') {
        this.onCanvasChange({
          pageIndex: this.currentPageIndex,
          pageData: JSON.stringify(this.canvas),
          pageStructure: this.getPageStructure()
        });
      }
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
      this.addNewPage();
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
}