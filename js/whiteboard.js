class Whiteboard {
  constructor() {
    this.canvas = new fabric.Canvas('whiteboard', {
      isDrawingMode: false // Start with drawing mode off
    });
    // Panning state
    this.isPanning = false;
    this.lastPosX = 0;
    this.lastPosY = 0;

    this.currentTool = 'pencil';
    this.color = '#000000';
    this.brushSize = 3;
    this.pages = [];
    this.currentPageIndex = 0;
    this.changeTimeout = null;

    this.initialize();
  }

  initialize() {
    this.setupCanvas();
    this.addNewPage();
    this.setTool('pencil');
    this.setupCanvasEvents();
    window.addEventListener('resize', () => this.handleResize());
  }

  handleResize() {
    this.setupCanvas();
  }

  setupCanvas() {
    const canvasContainer = document.getElementById('whiteboard').parentElement;
    const containerWidth = canvasContainer.clientWidth;
    const containerHeight = canvasContainer.clientHeight;

    this.canvas.setWidth(containerWidth);
    this.canvas.setHeight(containerHeight);

    this.canvas.setBackgroundColor('#FFF', this.canvas.renderAll.bind(this.canvas));
    this.canvas.renderAll();
  }

  setTool(tool) {
    this.currentTool = tool;
    this.canvas.isDrawingMode = false;
    this.canvas.selection = false;
    this.canvas.defaultCursor = 'default';

    if (tool === 'pan') {
      this.canvas.defaultCursor = 'grab';
    } else if (tool === 'pencil' || tool === 'eraser') {
      this.canvas.isDrawingMode = true;
      this.canvas.freeDrawingBrush.color = tool === 'eraser' ? '#FFFFFF' : this.color;
      this.canvas.freeDrawingBrush.width = tool === 'eraser' ? this.brushSize * 2 : this.brushSize;
      this.canvas.defaultCursor = 'crosshair';
    } else {
      // For shapes, text, or selection
      this.canvas.selection = true; // Allow selecting objects
      this.canvas.defaultCursor = 'crosshair';
    }
  }

  // This now only handles the `path-created` event for optimized pencil drawing
  receiveContinuousDrawing(drawingData) {
    if (drawingData.pageIndex !== this.currentPageIndex) return;

    if (drawingData.type === 'path-created' && drawingData.data) {
        fabric.util.enlivenObjects([drawingData.data], (objects) => {
            if (objects.length > 0) {
                const path = objects[0];
                this.canvas.add(path);
                this.canvas.requestRenderAll();
            }
        });
    }
  }

  setupCanvasEvents() {
    let shape, startPoint, isDrawingShape = false;

    this.canvas.on('mouse:down', (options) => {
      const pointer = this.canvas.getPointer(options.e);
      this.lastPosX = pointer.x;
      this.lastPosY = pointer.y;
      
      // 1. Panning Logic
      if (this.currentTool === 'pan' || options.e.altKey) {
        this.isPanning = true;
        this.canvas.defaultCursor = 'grabbing';
        return;
      }
      
      // 2. If using pencil/eraser, let Fabric.js handle everything
      if (this.canvas.isDrawingMode) {
        return;
      }

      // 3. Shape and Text Drawing Logic
      isDrawingShape = true;
      startPoint = pointer;

      switch (this.currentTool) {
        case 'line':
          shape = new fabric.Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], { stroke: this.color, strokeWidth: this.brushSize, selectable: false });
          break;
        case 'rect':
          shape = new fabric.Rect({ left: startPoint.x, top: startPoint.y, width: 0, height: 0, fill: 'transparent', stroke: this.color, strokeWidth: this.brushSize, selectable: false });
          break;
        case 'circle':
          shape = new fabric.Circle({ left: startPoint.x, top: startPoint.y, radius: 0, fill: 'transparent', stroke: this.color, strokeWidth: this.brushSize, selectable: false });
          break;
        case 'text':
           const text = new fabric.IText('Text', { left: startPoint.x, top: startPoint.y, fontFamily: 'Arial', fill: this.color, fontSize: this.brushSize * 5, selectable: true });
           this.canvas.add(text);
           this.canvas.setActiveObject(text);
           text.enterEditing();
           text.on('editing:exited', () => this.notifyChange()); // Sync when text editing is done
           isDrawingShape = false; // Text is a one-click action
           break;
        default:
          isDrawingShape = false;
      }
      if (shape) this.canvas.add(shape);
    });

    this.canvas.on('mouse:move', (options) => {
      if (this.isPanning) {
        const pointer = this.canvas.getPointer(options.e);
        const vpt = this.canvas.viewportTransform;
        vpt[4] += pointer.x - this.lastPosX;
        vpt[5] += pointer.y - this.lastPosY;
        this.canvas.requestRenderAll();
        this.lastPosX = pointer.x;
        this.lastPosY = pointer.y;
        return;
      }
      
      if (!isDrawingShape || !shape) return;

      const pointer = this.canvas.getPointer(options.e);
      const left = Math.min(pointer.x, startPoint.x);
      const top = Math.min(pointer.y, startPoint.y);

      switch (this.currentTool) {
          case 'line':
              shape.set({ x2: pointer.x, y2: pointer.y });
              break;
          case 'rect':
              shape.set({ width: Math.abs(startPoint.x - pointer.x), height: Math.abs(startPoint.y - pointer.y), left, top });
              break;
          case 'circle':
              const radius = Math.sqrt(Math.pow(startPoint.x - pointer.x, 2) + Math.pow(startPoint.y - pointer.y, 2)) / 2;
              shape.set({ radius, left, top });
              break;
      }
      this.canvas.requestRenderAll();
    });

    this.canvas.on('mouse:up', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.canvas.defaultCursor = (this.currentTool === 'pan') ? 'grab' : 'default';
        return;
      }
      
      // --- THE CRITICAL FIX IS HERE ---
      // If we were drawing a shape, it's now finished.
      if (isDrawingShape && shape) {
        shape.set({ selectable: true }); // Make the final shape selectable
        shape.setCoords();
        this.notifyChange(); // Sync the canvas state
      }
      // --- END FIX ---

      isDrawingShape = false;
      shape = null;
    });
    
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

    this.canvas.on('path:created', (e) => {
        if (this.onContinuousDrawing) {
            const pathData = e.path.toJSON();
            this.onContinuousDrawing({ type: 'path-created', data: pathData, pageIndex: this.currentPageIndex });
        }
    });

    this.canvas.on('object:modified', () => {
      this.notifyChange();
    });
  }

  notifyChange() {
    clearTimeout(this.changeTimeout);
    this.changeTimeout = setTimeout(() => {
      this.saveCurrentPage();
      if (this.onCanvasChange) {
        const canvasData = JSON.stringify(this.canvas);
        this.onCanvasChange({ pageIndex: this.currentPageIndex, pageData: canvasData });
      }
    }, 200);
  }
  
  clearCurrentPage() {
    this.canvas.clear();
    this.canvas.setBackgroundColor('#FFF', this.canvas.renderAll.bind(this.canvas));
    this.notifyChange();
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

  // --- Utility Methods (Unchanged but included for completeness) ---
  addNewPage() {
    const pageNumber = this.pages.length + 1;
    this.pages.push({ id: `page-${pageNumber}`, data: null });
    this.goToPage(this.pages.length - 1);
  }

  deletePage(index) {
    if (this.pages.length > 1) {
      this.pages.splice(index, 1);
      const newIndex = Math.max(0, index - 1);
      this.goToPage(newIndex);
    }
  }

  goToPage(index, skipCallback = false) {
    if (index < 0 || index >= this.pages.length) return;
    this.saveCurrentPage();
    this.currentPageIndex = index;
    this.loadPage(index, skipCallback);
  }

  saveCurrentPage() {
    if (this.pages[this.currentPageIndex]) {
      this.pages[this.currentPageIndex].data = JSON.stringify(this.canvas);
    }
  }

  loadPage(index, skipCallback = false) {
    const page = this.pages[index];
    if (!page) return;

    this.canvas.loadFromJSON(page.data, () => {
      this.canvas.setBackgroundColor('#FFF');
      this.canvas.renderAll();
    });

    if (!skipCallback && this.onPageChange) {
      this.onPageChange({ currentPage: index + 1, totalPages: this.pages.length });
    }
  }
  
  setColor(color) { this.color = color; this.canvas.freeDrawingBrush.color = color; }
  setBrushSize(size) { this.brushSize = size; this.canvas.freeDrawingBrush.width = size; }
  setChangeCallback(c) { this.onCanvasChange = c; }
  setPagesChangeCallback(c) { this.onPagesChange = c; }
  setPageChangeCallback(c) { this.onPageChange = c; }
  setContinuousDrawingCallback(c) { this.onContinuousDrawing = c; }
}
