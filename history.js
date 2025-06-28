export class HistoryManager {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
    this.maxHistorySize = 50;
  }
  
  saveState(elements) {
    // Remove any future states if we're not at the end
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }
    
    // Deep clone the elements
    const state = JSON.parse(JSON.stringify(elements));
    this.history.push(state);
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
    
    this.updateButtons();
  }
  
  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateButtons();
      return JSON.parse(JSON.stringify(this.history[this.currentIndex]));
    }
    return null;
  }
  
  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      this.updateButtons();
      return JSON.parse(JSON.stringify(this.history[this.currentIndex]));
    }
    return null;
  }
  
  updateButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    
    undoBtn.disabled = this.currentIndex <= 0;
    redoBtn.disabled = this.currentIndex >= this.history.length - 1;
  }
}