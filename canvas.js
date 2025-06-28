export class CanvasManager {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
  }
  
  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }
  
  applyTransform(panOffset, zoom) {
    this.ctx.setTransform(zoom, 0, 0, zoom, panOffset.x, panOffset.y);
  }
  
  drawElement(ctx, element) {
    ctx.save();
    
    ctx.strokeStyle = element.strokeColor;
    ctx.fillStyle = element.fillColor === 'transparent' ? 'transparent' : element.fillColor;
    ctx.lineWidth = element.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    switch (element.type) {
      case 'rectangle':
        this.drawRectangle(ctx, element);
        break;
      case 'circle':
        this.drawCircle(ctx, element);
        break;
      case 'arrow':
        this.drawArrow(ctx, element);
        break;
      case 'line':
        this.drawLine(ctx, element);
        break;
      case 'pencil':
        this.drawPencil(ctx, element);
        break;
      case 'text':
        this.drawText(ctx, element);
        break;
    }
    
    ctx.restore();
  }
  
  drawRectangle(ctx, element) {
    const { x, y, width, height } = element;
    
    if (element.fillColor !== 'transparent') {
      ctx.fillRect(x, y, width, height);
    }
    ctx.strokeRect(x, y, width, height);
  }
  
  drawCircle(ctx, element) {
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    const radiusX = Math.abs(element.width) / 2;
    const radiusY = Math.abs(element.height) / 2;
    
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    
    if (element.fillColor !== 'transparent') {
      ctx.fill();
    }
    ctx.stroke();
  }
  
  drawArrow(ctx, element) {
    const { x, y, width, height } = element;
    const endX = x + width;
    const endY = y + height;
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Draw arrowhead
    const angle = Math.atan2(height, width);
    const arrowLength = 15;
    const arrowAngle = Math.PI / 6;
    
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowLength * Math.cos(angle - arrowAngle),
      endY - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowLength * Math.cos(angle + arrowAngle),
      endY - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.stroke();
  }
  
  drawLine(ctx, element) {
    const { x, y, width, height } = element;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y + height);
    ctx.stroke();
  }
  
  drawPencil(ctx, element) {
    if (element.points && element.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(element.points[0].x, element.points[0].y);
      
      for (let i = 1; i < element.points.length; i++) {
        ctx.lineTo(element.points[i].x, element.points[i].y);
      }
      
      ctx.stroke();
    }
  }
  
  drawText(ctx, element) {
    if (element.text) {
      ctx.font = `${element.fontSize || 16}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = element.strokeColor;
      ctx.textBaseline = 'top';
      
      const lines = element.text.split('\n');
      const lineHeight = element.fontSize || 16;
      
      lines.forEach((line, index) => {
        ctx.fillText(line, element.x, element.y + index * lineHeight);
      });
    }
  }
  
  drawSelection(ctx, element) {
    ctx.save();
    ctx.strokeStyle = '#6366f1';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    
    const bounds = this.getElementBounds(element);
    ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4);
    
    ctx.restore();
  }
  
  getElementBounds(element) {
    switch (element.type) {
      case 'text':
        return {
          x: element.x,
          y: element.y,
          width: element.width || 100,
          height: element.height || 20
        };
      default:
        return {
          x: Math.min(element.x, element.x + element.width),
          y: Math.min(element.y, element.y + element.height),
          width: Math.abs(element.width),
          height: Math.abs(element.height)
        };
    }
  }
}