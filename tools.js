export class ToolManager {
  constructor() {
    this.currentTool = 'selection';
    this.properties = {
      strokeColor: '#000000',
      fillColor: 'transparent',
      strokeWidth: 1
    };
  }
  
  setTool(tool) {
    this.currentTool = tool;
  }
  
  getCurrentTool() {
    return this.currentTool;
  }
  
  setStrokeColor(color) {
    this.properties.strokeColor = color;
  }
  
  setFillColor(color) {
    this.properties.fillColor = color;
  }
  
  setStrokeWidth(width) {
    this.properties.strokeWidth = width;
  }
  
  getCurrentProperties() {
    return { ...this.properties };
  }
}