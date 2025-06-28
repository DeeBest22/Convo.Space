import { ToolManager } from './tools.js';
import { CanvasManager } from './canvas.js';
import { ElementManager } from './elements.js';
import { UIManager } from './ui.js';
import { HistoryManager } from './history.js';

export class WhiteboardApp {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.toolManager = null;
    this.canvasManager = null;
    this.elementManager = null;
    this.uiManager = null;
    this.historyManager = null;
    
    this.isDrawing = false;
    this.startPoint = null;
    this.currentElement = null;
    this.selectedElements = [];
    
    // Pan and zoom state
    this.panOffset = { x: 0, y: 0 };
    this.zoom = 1;
    this.isPanning = false;
    this.lastPanPoint = { x: 0, y: 0 };
  }
  
  init() {
    this.setupCanvas();
    this.initializeManagers();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.render();
  }
  
  setupCanvas() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Set canvas size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }
  
  resizeCanvas() {
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
    this.render();
  }
  
  initializeManagers() {
    this.toolManager = new ToolManager();
    this.canvasManager = new CanvasManager(this.canvas, this.ctx);
    this.elementManager = new ElementManager();
    this.uiManager = new UIManager();
    this.historyManager = new HistoryManager();
    
    // Set initial state
    this.historyManager.saveState(this.elementManager.getElements());
  }
  
  setupEventListeners() {
    // Canvas events
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
    
    // Touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    
    // Tool selection
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.currentTarget.dataset.tool;
        this.toolManager.setTool(tool);
        this.uiManager.updateToolButtons(tool);
        this.updateCursor();
      });
    });
    
    // Undo/Redo
    document.getElementById('undo-btn').addEventListener('click', () => this.undo());
    document.getElementById('redo-btn').addEventListener('click', () => this.redo());
    
    // Export
    document.getElementById('export-btn').addEventListener('click', () => this.export());
    
    // Zoom controls
    document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
    document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
    document.getElementById('zoom-reset').addEventListener('click', () => this.resetZoom());
    
    // Property changes
    document.getElementById('stroke-color').addEventListener('change', (e) => {
      this.toolManager.setStrokeColor(e.target.value);
      this.updateSelectedElements();
    });
    
    document.getElementById('fill-color').addEventListener('change', (e) => {
      this.toolManager.setFillColor(e.target.value);
      this.updateSelectedElements();
    });
    
    document.getElementById('transparent-fill').addEventListener('click', () => {
      this.toolManager.setFillColor('transparent');
      this.updateSelectedElements();
    });
    
    document.querySelectorAll('.stroke-width-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const width = parseInt(e.currentTarget.dataset.width);
        this.toolManager.setStrokeWidth(width);
        this.uiManager.updateStrokeWidthButtons(width);
        this.updateSelectedElements();
      });
    });
  }
  
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'v': this.selectTool('selection'); break;
          case 'r': this.selectTool('rectangle'); break;
          case 'o': this.selectTool('circle'); break;
          case 'a': this.selectTool('arrow'); break;
          case 'l': this.selectTool('line'); break;
          case 'p': this.selectTool('pencil'); break;
          case 't': this.selectTool('text'); break;
          case 'delete':
          case 'backspace':
            this.deleteSelected();
            break;
          case 'escape':
            this.clearSelection();
            break;
        }
      }
      
      // Undo/Redo shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              this.redo();
            } else {
              this.undo();
            }
            break;
          case 'y':
            e.preventDefault();
            this.redo();
            break;
          case 'a':
            e.preventDefault();
            this.selectAll();
            break;
        }
      }
    });
  }
  
  selectTool(tool) {
    this.toolManager.setTool(tool);
    this.uiManager.updateToolButtons(tool);
    this.updateCursor();
  }
  
  updateCursor() {
    const container = document.getElementById('canvas-container');
    const tool = this.toolManager.getCurrentTool();
    
    container.classList.remove('drawing', 'text-tool', 'panning');
    
    if (tool === 'text') {
      container.classList.add('text-tool');
    } else if (tool !== 'selection') {
      container.classList.add('drawing');
    }
  }
  
  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - this.panOffset.x) / this.zoom,
      y: (e.clientY - rect.top - this.panOffset.y) / this.zoom
    };
  }
  
  getTouchPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    return {
      x: (touch.clientX - rect.left - this.panOffset.x) / this.zoom,
      y: (touch.clientY - rect.top - this.panOffset.y) / this.zoom
    };
  }
  
  handleMouseDown(e) {
    e.preventDefault();
    const pos = this.getMousePos(e);
    const tool = this.toolManager.getCurrentTool();
    
    // Check for panning (middle mouse or space + left mouse)
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      this.startPanning(pos);
      return;
    }
    
    if (tool === 'selection') {
      this.handleSelectionMouseDown(pos, e);
    } else if (tool === 'text') {
      this.handleTextMouseDown(pos);
    } else {
      this.startDrawing(pos, tool);
    }
  }
  
  handleMouseMove(e) {
    const pos = this.getMousePos(e);
    
    if (this.isPanning) {
      this.updatePan(pos);
      return;
    }
    
    if (this.isDrawing && this.currentElement) {
      this.updateDrawing(pos);
    }
  }
  
  handleMouseUp(e) {
    const pos = this.getMousePos(e);
    
    if (this.isPanning) {
      this.endPanning();
      return;
    }
    
    if (this.isDrawing) {
      this.endDrawing(pos);
    }
  }
  
  handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const pos = this.getTouchPos(e);
      this.handleMouseDown({ ...e, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, button: 0 });
    }
  }
  
  handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const pos = this.getTouchPos(e);
      this.handleMouseMove({ ...e, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }
  }
  
  handleTouchEnd(e) {
    e.preventDefault();
    if (e.changedTouches.length === 1) {
      const pos = this.getTouchPos(e);
      this.handleMouseUp({ ...e, clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY });
    }
  }
  
  handleWheel(e) {
    e.preventDefault();
    
    const pos = this.getMousePos(e);
    const zoomIntensity = 0.1;
    const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
    
    this.zoomAt(pos, delta);
  }
  
  startPanning(pos) {
    this.isPanning = true;
    this.lastPanPoint = { x: pos.x * this.zoom + this.panOffset.x, y: pos.y * this.zoom + this.panOffset.y };
    document.getElementById('canvas-container').classList.add('panning');
  }
  
  updatePan(pos) {
    if (this.isPanning) {
      const currentPoint = { x: pos.x * this.zoom + this.panOffset.x, y: pos.y * this.zoom + this.panOffset.y };
      this.panOffset.x += currentPoint.x - this.lastPanPoint.x;
      this.panOffset.y += currentPoint.y - this.lastPanPoint.y;
      this.lastPanPoint = currentPoint;
      this.render();
    }
  }
  
  endPanning() {
    this.isPanning = false;
    document.getElementById('canvas-container').classList.remove('panning');
  }
  
  zoomAt(pos, delta) {
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.1, Math.min(5, this.zoom + delta));
    
    if (this.zoom !== oldZoom) {
      const zoomFactor = this.zoom / oldZoom;
      this.panOffset.x = pos.x * this.zoom - (pos.x * oldZoom - this.panOffset.x) * zoomFactor;
      this.panOffset.y = pos.y * this.zoom - (pos.y * oldZoom - this.panOffset.y) * zoomFactor;
      
      this.render();
      this.uiManager.updateZoomLevel(this.zoom);
    }
  }
  
  zoomIn() {
    const center = { x: this.canvas.width / (2 * devicePixelRatio), y: this.canvas.height / (2 * devicePixelRatio) };
    this.zoomAt(center, 0.2);
  }
  
  zoomOut() {
    const center = { x: this.canvas.width / (2 * devicePixelRatio), y: this.canvas.height / (2 * devicePixelRatio) };
    this.zoomAt(center, -0.2);
  }
  
  resetZoom() {
    this.zoom = 1;
    this.panOffset = { x: 0, y: 0 };
    this.render();
    this.uiManager.updateZoomLevel(this.zoom);
  }
  
  handleSelectionMouseDown(pos, e) {
    const clickedElement = this.elementManager.getElementAt(pos);
    
    if (clickedElement) {
      if (!this.selectedElements.includes(clickedElement)) {
        if (!e.shiftKey) {
          this.selectedElements = [clickedElement];
        } else {
          this.selectedElements.push(clickedElement);
        }
      }
      this.startDragging(pos);
    } else {
      if (!e.shiftKey) {
        this.selectedElements = [];
      }
      this.startSelectionBox(pos);
    }
    
    this.updateSelection();
  }
  
  handleTextMouseDown(pos) {
    this.createTextElement(pos);
  }
  
  startDrawing(pos, tool) {
    this.isDrawing = true;
    this.startPoint = pos;
    
    const properties = this.toolManager.getCurrentProperties();
    this.currentElement = this.elementManager.createElement(tool, pos, properties);
  }
  
  updateDrawing(pos) {
    if (this.currentElement) {
      this.elementManager.updateElement(this.currentElement, this.startPoint, pos);
      this.render();
    }
  }
  
  endDrawing(pos) {
    if (this.isDrawing && this.currentElement) {
      this.elementManager.finalizeElement(this.currentElement, this.startPoint, pos);
      this.historyManager.saveState(this.elementManager.getElements());
      this.currentElement = null;
    }
    
    this.isDrawing = false;
    this.render();
  }
  
  createTextElement(pos) {
    const properties = this.toolManager.getCurrentProperties();
    const textElement = this.elementManager.createElement('text', pos, properties);
    
    // Create text input
    const input = document.createElement('textarea');
    input.className = 'text-input';
    input.style.left = (pos.x * this.zoom + this.panOffset.x) + 'px';
    input.style.top = (pos.y * this.zoom + this.panOffset.y) + 'px';
    input.style.fontSize = (16 * this.zoom) + 'px';
    input.placeholder = 'Type here...';
    
    document.getElementById('canvas-container').appendChild(input);
    input.focus();
    
    const finishText = () => {
      const text = input.value.trim();
      if (text) {
        textElement.text = text;
        this.elementManager.addElement(textElement);
        this.historyManager.saveState(this.elementManager.getElements());
      }
      input.remove();
      this.render();
    };
    
    input.addEventListener('blur', finishText);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        finishText();
      }
      if (e.key === 'Escape') {
        input.remove();
      }
    });
  }
  
  startDragging(pos) {
    // Implementation for dragging selected elements
  }
  
  startSelectionBox(pos) {
    // Implementation for selection box
  }
  
  updateSelection() {
    this.uiManager.showPropertiesPanel(this.selectedElements.length > 0);
    this.render();
  }
  
  updateSelectedElements() {
    const properties = this.toolManager.getCurrentProperties();
    this.selectedElements.forEach(element => {
      Object.assign(element, properties);
    });
    this.render();
  }
  
  clearSelection() {
    this.selectedElements = [];
    this.updateSelection();
  }
  
  selectAll() {
    this.selectedElements = [...this.elementManager.getElements()];
    this.updateSelection();
  }
  
  deleteSelected() {
    this.selectedElements.forEach(element => {
      this.elementManager.removeElement(element);
    });
    this.selectedElements = [];
    this.historyManager.saveState(this.elementManager.getElements());
    this.updateSelection();
  }
  
  undo() {
    const state = this.historyManager.undo();
    if (state) {
      this.elementManager.setElements(state);
      this.selectedElements = [];
      this.render();
    }
  }
  
  redo() {
    const state = this.historyManager.redo();
    if (state) {
      this.elementManager.setElements(state);
      this.selectedElements = [];
      this.render();
    }
  }
  
  export() {
    const bounds = this.elementManager.getBounds();
    if (!bounds) return;
    
    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');
    
    const padding = 20;
    exportCanvas.width = bounds.width + padding * 2;
    exportCanvas.height = bounds.height + padding * 2;
    
    exportCtx.fillStyle = 'white';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    
    exportCtx.translate(-bounds.x + padding, -bounds.y + padding);
    
    this.elementManager.getElements().forEach(element => {
      this.canvasManager.drawElement(exportCtx, element);
    });
    
    const link = document.createElement('a');
    link.download = 'excalidraw-export.png';
    link.href = exportCanvas.toDataURL();
    link.click();
  }
  
  render() {
    this.canvasManager.clear();
    this.canvasManager.applyTransform(this.panOffset, this.zoom);
    
    // Draw all elements
    this.elementManager.getElements().forEach(element => {
      this.canvasManager.drawElement(this.ctx, element);
    });
    
    // Draw current drawing element
    if (this.currentElement) {
      this.canvasManager.drawElement(this.ctx, this.currentElement);
    }
    
    // Draw selection
    this.selectedElements.forEach(element => {
      this.canvasManager.drawSelection(this.ctx, element);
    });
  }
}