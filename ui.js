export class UIManager {
  constructor() {
    this.propertiesPanel = document.getElementById('properties-panel');
  }
  
  updateToolButtons(activeTool) {
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === activeTool);
    });
  }
  
  updateStrokeWidthButtons(activeWidth) {
    document.querySelectorAll('.stroke-width-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.width) === activeWidth);
    });
  }
  
  showPropertiesPanel(show) {
    this.propertiesPanel.style.display = show ? 'block' : 'none';
  }
  
  updateZoomLevel(zoom) {
    document.getElementById('zoom-level').textContent = Math.round(zoom * 100) + '%';
  }
}