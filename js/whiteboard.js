class Whiteboard {
  constructor() {
    this.canvas = new fabric.Canvas('whiteboard');
    this.isDrawing = false;
    this.currentTool = 'pencil';
    this.color = '#000000';
    this.brushSize = 3;
    this.isPanning = false;
    this.lastPanPoint = { x: 0, y: 0 };
    this.canvasSize = {
      width: 3970,  // 5 A4 pages wide (794 * 5)
      height: 2246  // 2 A4 pages tall (1123 * 2)
    };
    this.initialize();
  }

  initialize() {
    // Set large canvas size
    this.setupLargeCanvas();
    
    // Initialize drawing mode
    this.setTool('pencil');

    // Setup event listeners for canvas events
    this.setupCanvasEvents();
    
    // Add A4 page grid
    this.addPageGrid();
  }

  setupLargeCanvas() {
    // Set canvas to large size
    this.canvas.setWidth(this.canvasSize.width);
    this.canvas.setHeight(this.canvasSize.height);
    
    // Set viewport to show portion of canvas
    const container = document.getElementById('whiteboard').parentElement;
    const viewportWidth = Math.min(container.clientWidth, 1000);
    const viewportHeight = 600;
    
    // Create viewport container
    const canvasContainer = document.getElementById('whiteboard').parentElement;
    canvasContainer.style.width = `${viewportWidth}px`;
    canvasContainer.style.height = `${viewportHeight}px`;
    canvasContainer.style.overflow = 'hidden';
    canvasContainer.style.position = 'relative';
    
    // Set canvas element size for viewport
    this.canvas.setDimensions({
      width: viewportWidth,
      height: viewportHeight
    }, { cssOnly: true });
    
    // Initialize viewport
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    
    this.canvas.renderAll();
  }

  addPageGrid() {
    // Add A4 page boundaries as light gray lines
    const a4Width = 794;
    const a4Height = 1123;
    
    // Vertical lines (5 pages wide)
    for (let i = 1; i < 5; i++) {
      const line = new fabric.Line([i * a4Width, 0, i * a4Width, this.canvasSize.height], {
        stroke: '#e0e0e0',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        name: 'grid-line'
      });
      this.canvas.add(line);
    }
    
    // Horizontal lines (2 pages tall)
    for (let i = 1; i < 2; i++) {
      const line = new fabric.Line([0, i * a4Height, this.canvasSize.width, i * a4Height], {
        stroke: '#e0e0e0',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        name: 'grid-line'
      });
      this.canvas.add(line);
    }
    
    // Add page numbers
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 5; col++) {
        const pageNum = row * 5 + col + 1;
        const text = new fabric.Text(`Page ${pageNum}`, {
          left: col * a4Width + 20,
          top: row * a4Height + 20,
          fontSize: 12,
          fill: '#ccc',
          selectable: false,
          evented: false,
          name: 'page-number'
        });
        this.canvas.add(text);
      }
    }
  }

  setTool(tool) {
    this.currentTool = tool;

    // Reset canvas mode
    this.canvas.isDrawingMode = false;
    this.isPanning = false;

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
      case 'pan':
        this.isPanning = true;
        this.canvas.defaultCursor = 'grab';
        break;
      // Other tools will be handled by canvas events
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
      if (this.isPanning) {
        this.canvas.defaultCursor = 'grabbing';
        this.lastPanPoint = { x: options.e.clientX, y: options.e.clientY };
        return;
      }
      
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
      if (this.isPanning && this.lastPanPoint) {
        const deltaX = options.e.clientX - this.lastPanPoint.x;
        const deltaY = options.e.clientY - this.lastPanPoint.y;
        
        const vpt = this.canvas.viewportTransform;
        vpt[4] += deltaX;
        vpt[5] += deltaY;
        
        this.canvas.setViewportTransform(vpt);
        this.lastPanPoint = { x: options.e.clientX, y: options.e.clientY };
        return;
      }
      
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
      if (this.isPanning) {
        this.canvas.defaultCursor = 'grab';
        this.lastPanPoint = null;
        return;
      }
      
      this.isDrawing = false;
      this.canvas.renderAll();
      
      // Emit canvas data to peers
      if (typeof this.onCanvasChange === 'function') {
        this.onCanvasChange(JSON.stringify(this.canvas));
      }
    });

    // Handle object modifications
    this.canvas.on('object:modified', () => {
      if (typeof this.onCanvasChange === 'function') {
        this.onCanvasChange(JSON.stringify(this.canvas));
      }
    });

    // Handle mouse wheel for zoom
    this.canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = this.canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.1) zoom = 0.1;
      this.canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });
  }

  // Add method to center viewport on a specific page
  goToPage(pageNumber) {
    if (pageNumber < 1 || pageNumber > 10) return;
    
    const col = (pageNumber - 1) % 5;
    const row = Math.floor((pageNumber - 1) / 5);
    
    const x = col * 794 + 397; // Center of page horizontally
    const y = row * 1123 + 561; // Center of page vertically
    
    const vpt = this.canvas.viewportTransform;
    vpt[4] = -x + this.canvas.width / 2;
    vpt[5] = -y + this.canvas.height / 2;
    
    this.canvas.setViewportTransform(vpt);
    this.canvas.renderAll();
  }

  clearCanvas() {
    this.canvas.clear();
    this.addPageGrid(); // Re-add the grid after clearing
    if (typeof this.onCanvasChange === 'function') {
      this.onCanvasChange(JSON.stringify(this.canvas));
    }
  }

  // Method to update canvas from received data
  updateFromJSON(jsonData) {
    this.canvas.loadFromJSON(jsonData, () => {
      this.canvas.renderAll();
    });
  }

  // Set callback for canvas changes
  setChangeCallback(callback) {
    this.onCanvasChange = callback;
  }
}