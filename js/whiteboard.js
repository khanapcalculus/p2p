class Whiteboard {
  constructor() {
    this.canvas = new fabric.Canvas('whiteboard');
    this.isDrawing = false;
    this.currentTool = 'pencil';
    this.color = '#000000';
    this.brushSize = 3;
    this.initialize();
  }

  initialize() {
    // Set canvas size to match container
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Initialize drawing mode
    this.setTool('pencil');

    // Setup event listeners for canvas events
    this.setupCanvasEvents();
  }

  resizeCanvas() {
    const container = document.getElementById('whiteboard').parentElement;
    const width = container.clientWidth;
    const height = 500; // Fixed height

    this.canvas.setWidth(width);
    this.canvas.setHeight(height);
    this.canvas.renderAll();
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
  }

  clearCanvas() {
    this.canvas.clear();
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