export class ElementManager {
  constructor() {
    this.elements = [];
    this.nextId = 1;
  }
  
  createElement(type, pos, properties) {
    const element = {
      id: this.nextId++,
      type,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      ...properties
    };
    
    if (type === 'pencil') {
      element.points = [{ x: pos.x, y: pos.y }];
    }
    
    if (type === 'text') {
      element.text = '';
      element.fontSize = 16;
    }
    
    return element;
  }
  
  updateElement(element, startPos, currentPos) {
    switch (element.type) {
      case 'pencil':
        element.points.push({ x: currentPos.x, y: currentPos.y });
        break;
      default:
        element.width = currentPos.x - startPos.x;
        element.height = currentPos.y - startPos.y;
        break;
    }
  }
  
  finalizeElement(element, startPos, endPos) {
    if (element.type !== 'pencil') {
      element.width = endPos.x - startPos.x;
      element.height = endPos.y - startPos.y;
    }
    
    // Only add element if it has meaningful size or content
    if (this.isValidElement(element)) {
      this.elements.push(element);
    }
  }
  
  isValidElement(element) {
    switch (element.type) {
      case 'pencil':
        return element.points && element.points.length > 1;
      case 'text':
        return element.text && element.text.trim() !== '';
      default:
        return Math.abs(element.width) > 1 || Math.abs(element.height) > 1;
    }
  }
  
  addElement(element) {
    this.elements.push(element);
  }
  
  removeElement(element) {
    const index = this.elements.indexOf(element);
    if (index > -1) {
      this.elements.splice(index, 1);
    }
  }
  
  getElementAt(pos) {
    // Check elements in reverse order (top to bottom)
    for (let i = this.elements.length - 1; i >= 0; i--) {
      if (this.isPointInElement(pos, this.elements[i])) {
        return this.elements[i];
      }
    }
    return null;
  }
  
  isPointInElement(pos, element) {
    const bounds = this.getElementBounds(element);
    return pos.x >= bounds.x && 
           pos.x <= bounds.x + bounds.width && 
           pos.y >= bounds.y && 
           pos.y <= bounds.y + bounds.height;
  }
  
  getElementBounds(element) {
    switch (element.type) {
      case 'pencil':
        if (!element.points || element.points.length === 0) {
          return { x: 0, y: 0, width: 0, height: 0 };
        }
        
        const xs = element.points.map(p => p.x);
        const ys = element.points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        };
      
      case 'text':
        return {
          x: element.x,
          y: element.y,
          width: element.width || (element.text ? element.text.length * 8 : 100),
          height: element.height || (element.fontSize || 16)
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
  
  getBounds() {
    if (this.elements.length === 0) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    this.elements.forEach(element => {
      const bounds = this.getElementBounds(element);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
  
  getElements() {
    return this.elements;
  }
  
  setElements(elements) {
    this.elements = [...elements];
  }
}