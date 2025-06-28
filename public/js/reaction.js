  // Isolated Reaction Manager Class
class ReactionManager {
  constructor(socket, containerId = 'app') {
    this.socket = socket;
    this.container = document.getElementById(containerId);
    this.reactions = ['👍', '👏', '😂', '❤️', '😮', '😢'];
    this.activeReactions = new Map();
    this.raisedHands = new Set();
    this.namespace = 'rm-'; // Namespace prefix for all elements
    this.isDestroyed = false;
    
    // Bound methods to prevent conflicts
    this.boundHandlers = {
      reactionClick: this.handleReactionClick.bind(this),
      raiseHandClick: this.handleRaiseHandClick.bind(this),
      emojiClick: this.handleEmojiClick.bind(this),
      documentClick: this.handleDocumentClick.bind(this),
      keydown: this.handleKeydown.bind(this)
    };
    
    this.init();
  }

  init() {
    if (this.isDestroyed) return;
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.createReactionUI();
    this.setupSocketListeners();
    this.attachEventListeners();
  }

  createReactionUI() {
    // Create unique elements with namespace
    const reactionBtn = this.createElement('button', {
      className: 'control-btn rm-reaction-btn',
      id: `${this.namespace}reactionBtn`,
      innerHTML: '<i class="fas fa-smile"></i>',
      title: 'React'
    });

    const raiseHandBtn = this.createElement('button', {
      className: 'control-btn rm-raise-hand-btn',
      id: `${this.namespace}raiseHandBtn`,
      innerHTML: '<i class="fas fa-hand-paper"></i>',
      title: 'Raise Hand',
      'data-active': 'false'
    });

    // Create emoji picker with namespace
    const emojiPicker = this.createElement('div', {
      className: 'rm-emoji-picker',
      id: `${this.namespace}emojiPicker`,
      innerHTML: `
        <div class="rm-emoji-picker-content">
          ${this.reactions.map(emoji => `
            <button class="rm-emoji-btn" data-emoji="${emoji}" type="button">${emoji}</button>
          `).join('')}
        </div>
      `
    });

    // Create reaction overlay with namespace
    const reactionOverlay = this.createElement('div', {
      className: 'rm-reaction-overlay',
      id: `${this.namespace}reactionOverlay`
    });

    // Add CSS styles
    this.addStyles();

    // Insert into DOM safely
    this.insertIntoDOM(reactionBtn, raiseHandBtn, emojiPicker, reactionOverlay);
  }

  createElement(tag, attributes) {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'className') {
        element.className = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    return element;
  }

  insertIntoDOM(reactionBtn, raiseHandBtn, emojiPicker, reactionOverlay) {
    try {
      const taskbarCenter = document.querySelector('.taskbar-center');
      if (taskbarCenter) {
        const screenShareBtn = document.getElementById('screenShareBtn');
        if (screenShareBtn) {
          taskbarCenter.insertBefore(reactionBtn, screenShareBtn);
          taskbarCenter.insertBefore(raiseHandBtn, screenShareBtn);
        } else {
          // Fallback: append to taskbar center
          taskbarCenter.appendChild(reactionBtn);
          taskbarCenter.appendChild(raiseHandBtn);
        }
      } else {
        console.warn('ReactionManager: taskbar-center not found, appending to body');
        document.body.appendChild(reactionBtn);
        document.body.appendChild(raiseHandBtn);
      }

      document.body.appendChild(emojiPicker);
      document.body.appendChild(reactionOverlay);
    } catch (error) {
      console.error('ReactionManager: Error inserting into DOM:', error);
    }
  }

  addStyles() {
    if (document.getElementById(`${this.namespace}styles`)) return;

    const style = document.createElement('style');
    style.id = `${this.namespace}styles`;
    style.textContent = `
      .rm-reaction-btn[data-active="true"],
      .rm-raise-hand-btn[data-active="true"] {
        background: #fbbf24 !important;
        color: white !important;
      }

      .rm-emoji-picker {
        position: fixed;
        background: rgba(30, 41, 59, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 12px;
        z-index: 10000;
        transform: translateX(-50%) translateY(10px);
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
      }

      .rm-emoji-picker.rm-show {
        opacity: 1;
        visibility: visible;
        transform: translateX(-50%) translateY(0);
      }

      .rm-emoji-picker-content {
        display: flex;
        gap: 8px;
      }

      .rm-emoji-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        padding: 8px;
        border-radius: 8px;
        transition: background 0.2s ease;
      }

      .rm-emoji-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .rm-reaction-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
      }

      .rm-reaction-animation {
        position: absolute;
        z-index: 100;
        pointer-events: none;
        animation: rm-reactionFade 3s ease-out forwards;
      }

      .rm-reaction-emoji {
        font-size: 32px;
        margin-bottom: 4px;
      }

      .rm-reaction-name {
        font-size: 12px;
        color: white;
        background: rgba(0, 0, 0, 0.7);
        padding: 2px 8px;
        border-radius: 12px;
        text-align: center;
      }

      .rm-floating-reaction {
        position: absolute;
        pointer-events: none;
        animation: rm-floatingReaction 3s ease-out forwards;
      }

      .rm-floating-emoji {
        font-size: 48px;
        margin-bottom: 8px;
        text-align: center;
      }

      .rm-floating-name {
        font-size: 14px;
        color: white;
        background: rgba(0, 0, 0, 0.8);
        padding: 4px 12px;
        border-radius: 16px;
        text-align: center;
      }

      .rm-hand-raised-indicator {
        position: absolute;
        top: 10px;
        right: 10px;
        background: #fbbf24;
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        z-index: 10;
      }

      .rm-status-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        margin-left: 4px;
      }

      .rm-hand-raised-icon {
        background: #fbbf24 !important;
        color: white !important;
      }

      @keyframes rm-reactionFade {
        0% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        50% {
          opacity: 1;
          transform: translateY(-20px) scale(1.1);
        }
        100% {
          opacity: 0;
          transform: translateY(-40px) scale(0.8);
        }
      }

      @keyframes rm-floatingReaction {
        0% {
          opacity: 1;
          transform: translateY(0) scale(0.8);
        }
        20% {
          opacity: 1;
          transform: translateY(-20px) scale(1);
        }
        100% {
          opacity: 0;
          transform: translateY(-100px) scale(0.6);
        }
      }
    `;
    document.head.appendChild(style);
  }

  attachEventListeners() {
    const reactionBtn = document.getElementById(`${this.namespace}reactionBtn`);
    const raiseHandBtn = document.getElementById(`${this.namespace}raiseHandBtn`);
    const emojiPicker = document.getElementById(`${this.namespace}emojiPicker`);

    if (reactionBtn) {
      reactionBtn.addEventListener('click', this.boundHandlers.reactionClick);
    }

    if (raiseHandBtn) {
      raiseHandBtn.addEventListener('click', this.boundHandlers.raiseHandClick);
    }

    if (emojiPicker) {
      emojiPicker.addEventListener('click', this.boundHandlers.emojiClick);
    }

    // Global event listeners with namespace checks
    document.addEventListener('click', this.boundHandlers.documentClick);
    document.addEventListener('keydown', this.boundHandlers.keydown);
  }

  handleReactionClick(e) {
    if (this.isDestroyed) return;
    e.stopPropagation();
    this.toggleEmojiPicker();
  }

  handleRaiseHandClick(e) {
    if (this.isDestroyed) return;
    e.preventDefault();
    e.stopPropagation();
    this.toggleRaiseHand();
  }

  handleEmojiClick(e) {
    if (this.isDestroyed) return;
    if (e.target.classList.contains('rm-emoji-btn')) {
      const emoji = e.target.getAttribute('data-emoji');
      this.sendReaction(emoji);
      this.hideEmojiPicker();
    }
  }

  handleDocumentClick(e) {
    if (this.isDestroyed) return;
    
    const reactionBtn = document.getElementById(`${this.namespace}reactionBtn`);
    const emojiPicker = document.getElementById(`${this.namespace}emojiPicker`);
    
    if (reactionBtn && emojiPicker && 
        !reactionBtn.contains(e.target) && 
        !emojiPicker.contains(e.target)) {
      this.hideEmojiPicker();
    }
  }

  handleKeydown(e) {
    if (this.isDestroyed) return;
    if (e.key === 'Escape') {
      this.hideEmojiPicker();
    }
  }

  setupSocketListeners() {
    // Use namespaced event handlers to prevent conflicts
    this.socket.on('reaction-received', (data) => {
      if (!this.isDestroyed) {
        this.displayReaction(data);
      }
    });

    this.socket.on('hand-raised', (data) => {
      if (!this.isDestroyed) {
        this.updateHandRaised(data.socketId, data.participantName, true);
      }
    });

    this.socket.on('hand-lowered', (data) => {
      if (!this.isDestroyed) {
        this.updateHandRaised(data.socketId, data.participantName, false);
      }
    });

    this.socket.on('participants-with-raised-hands', (data) => {
      if (!this.isDestroyed) {
        this.raisedHands.clear();
        data.raisedHands.forEach(socketId => {
          this.raisedHands.add(socketId);
        });
        this.updateParticipantsDisplay();
      }
    });
  }

  toggleEmojiPicker() {
    const emojiPicker = document.getElementById(`${this.namespace}emojiPicker`);
    if (!emojiPicker) return;
    
    const isVisible = emojiPicker.classList.contains('rm-show');
    
    if (isVisible) {
      this.hideEmojiPicker();
    } else {
      this.showEmojiPicker();
    }
  }

  showEmojiPicker() {
    const emojiPicker = document.getElementById(`${this.namespace}emojiPicker`);
    const reactionBtn = document.getElementById(`${this.namespace}reactionBtn`);
    
    if (!emojiPicker || !reactionBtn) return;
    
    // Position the picker above the button
    const btnRect = reactionBtn.getBoundingClientRect();
    emojiPicker.style.left = `${btnRect.left + (btnRect.width / 2)}px`;
    emojiPicker.style.bottom = `${window.innerHeight - btnRect.top + 10}px`;
    
    emojiPicker.classList.add('rm-show');
  }

  hideEmojiPicker() {
    const emojiPicker = document.getElementById(`${this.namespace}emojiPicker`);
    if (emojiPicker) {
      emojiPicker.classList.remove('rm-show');
    }
  }

  sendReaction(emoji) {
    if (this.socket && !this.isDestroyed) {
      this.socket.emit('send-reaction', {
        emoji: emoji,
        timestamp: Date.now()
      });
    }
  }

  displayReaction(data) {
    if (this.isDestroyed) return;
    
    const { emoji, participantName, socketId } = data;
    
    // Find the participant's video wrapper
    const participantWrapper = document.querySelector(`[data-socket-id="${socketId}"]`);
    
    if (participantWrapper) {
      this.createReactionAnimation(emoji, participantWrapper, participantName);
    }

    // Also show in the reaction overlay
    this.createFloatingReaction(emoji, participantName);
  }

  createReactionAnimation(emoji, container, participantName) {
    if (this.isDestroyed) return;
    
    const reaction = document.createElement('div');
    reaction.className = 'rm-reaction-animation';
    reaction.innerHTML = `
      <div class="rm-reaction-emoji">${emoji}</div>
      <div class="rm-reaction-name">${participantName}</div>
    `;

    // Position randomly within the container
    const containerRect = container.getBoundingClientRect();
    const x = Math.random() * Math.max(0, containerRect.width - 60);
    const y = Math.random() * Math.max(0, containerRect.height - 60);
    
    reaction.style.left = `${x}px`;
    reaction.style.top = `${y}px`;

    container.appendChild(reaction);

    // Remove after animation
    setTimeout(() => {
      if (reaction && reaction.parentNode && !this.isDestroyed) {
        reaction.parentNode.removeChild(reaction);
      }
    }, 3000);
  }

  createFloatingReaction(emoji, participantName) {
    if (this.isDestroyed) return;
    
    const overlay = document.getElementById(`${this.namespace}reactionOverlay`);
    if (!overlay) return;
    
    const reaction = document.createElement('div');
    reaction.className = 'rm-floating-reaction';
    reaction.innerHTML = `
      <div class="rm-floating-emoji">${emoji}</div>
      <div class="rm-floating-name">${participantName}</div>
    `;

    // Random position
    reaction.style.left = `${Math.random() * (window.innerWidth - 100)}px`;
    reaction.style.top = `${Math.random() * (window.innerHeight - 200) + 100}px`;

    overlay.appendChild(reaction);

    // Remove after animation
    setTimeout(() => {
      if (reaction && reaction.parentNode && !this.isDestroyed) {
        reaction.parentNode.removeChild(reaction);
      }
    }, 3000);
  }

  toggleRaiseHand() {
    if (this.isDestroyed) return;
    
    const raiseHandBtn = document.getElementById(`${this.namespace}raiseHandBtn`);
    if (!raiseHandBtn) return;
    
    const isRaised = raiseHandBtn.getAttribute('data-active') === 'true';
    
    if (isRaised) {
      this.lowerHand();
    } else {
      this.raiseHand();
    }
  }

  raiseHand() {
    const raiseHandBtn = document.getElementById(`${this.namespace}raiseHandBtn`);
    if (!raiseHandBtn || this.isDestroyed) return;
    
    raiseHandBtn.setAttribute('data-active', 'true');
    raiseHandBtn.classList.add('rm-active');

    if (this.socket) {
      this.socket.emit('raise-hand');
    }
    
    this.raisedHands.add(this.socket.id);
    this.updateParticipantsDisplay();
  }

  lowerHand() {
    const raiseHandBtn = document.getElementById(`${this.namespace}raiseHandBtn`);
    if (!raiseHandBtn || this.isDestroyed) return;
    
    raiseHandBtn.setAttribute('data-active', 'false');
    raiseHandBtn.classList.remove('rm-active');

    if (this.socket) {
      this.socket.emit('lower-hand');
    }
    
    this.raisedHands.delete(this.socket.id);
    this.updateParticipantsDisplay();
  }

  updateHandRaised(socketId, participantName, isRaised) {
    if (this.isDestroyed) return;
    
    if (isRaised) {
      this.raisedHands.add(socketId);
      this.showToast(`${participantName} raised their hand`, 'info');
    } else {
      this.raisedHands.delete(socketId);
      this.showToast(`${participantName} lowered their hand`, 'info');
    }

    this.updateParticipantsDisplay();
  }

  updateParticipantsDisplay() {
    if (this.isDestroyed) return;
    
    // Update participant items in the list (avoid conflicts)
    const participantItems = document.querySelectorAll('.participant-item');
    participantItems.forEach(item => {
      const socketId = item.getAttribute('data-socket-id');
      let handIcon = item.querySelector('.rm-hand-raised-icon');
      
      if (this.raisedHands.has(socketId)) {
        if (!handIcon) {
          const icon = document.createElement('div');
          icon.className = 'status-icon rm-hand-raised-icon';
          icon.innerHTML = '<i class="fas fa-hand-paper"></i>';
          icon.title = 'Hand raised';
          const statusContainer = item.querySelector('.participant-status');
          if (statusContainer) {
            statusContainer.appendChild(icon);
          }
        }
      } else if (handIcon) {
        handIcon.remove();
      }
    });

    // Update video wrappers with hand raised indicator
    const videoWrappers = document.querySelectorAll('.video-wrapper');
    videoWrappers.forEach(wrapper => {
      const socketId = wrapper.getAttribute('data-socket-id');
      let handIndicator = wrapper.querySelector('.rm-hand-raised-indicator');
      
      if (this.raisedHands.has(socketId)) {
        if (!handIndicator) {
          handIndicator = document.createElement('div');
          handIndicator.className = 'rm-hand-raised-indicator';
          handIndicator.innerHTML = '<i class="fas fa-hand-paper"></i>';
          wrapper.appendChild(handIndicator);
        }
      } else if (handIndicator) {
        handIndicator.remove();
      }
    });
  }

  showToast(message, type = 'success') {
    if (this.isDestroyed) return;
    
    // Check if a toast function exists in the global scope to avoid duplicates
    if (window.showToast && typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }
    
    const toast = document.createElement('div');
    toast.className = `rm-toast rm-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ef4444' : type === 'info' ? '#3b82f6' : '#10b981'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10001;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode && !this.isDestroyed) {
          toast.remove();
        }
      }, 300);
    }, 3000);
  }

  // Safe method to be called when participants list is updated
  onParticipantsUpdated() {
    if (!this.isDestroyed) {
      this.updateParticipantsDisplay();
    }
  }

  // Enhanced cleanup method
  destroy() {
    this.isDestroyed = true;
    
    // Remove event listeners
    const reactionBtn = document.getElementById(`${this.namespace}reactionBtn`);
    const raiseHandBtn = document.getElementById(`${this.namespace}raiseHandBtn`);
    const emojiPicker = document.getElementById(`${this.namespace}emojiPicker`);

    if (reactionBtn) {
      reactionBtn.removeEventListener('click', this.boundHandlers.reactionClick);
    }
    if (raiseHandBtn) {
      raiseHandBtn.removeEventListener('click', this.boundHandlers.raiseHandClick);
    }
    if (emojiPicker) {
      emojiPicker.removeEventListener('click', this.boundHandlers.emojiClick);
    }

    document.removeEventListener('click', this.boundHandlers.documentClick);
    document.removeEventListener('keydown', this.boundHandlers.keydown);

    // Remove DOM elements
    const elementsToRemove = [
      `${this.namespace}emojiPicker`,
      `${this.namespace}reactionOverlay`,
      `${this.namespace}reactionBtn`,
      `${this.namespace}raiseHandBtn`,
      `${this.namespace}styles`
    ];

    elementsToRemove.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.remove();
      }
    });

    // Remove any lingering reaction elements
    document.querySelectorAll('.rm-reaction-animation, .rm-floating-reaction, .rm-hand-raised-indicator, .rm-hand-raised-icon, .rm-toast').forEach(el => {
      el.remove();
    });

    // Clear collections
    this.activeReactions.clear();
    this.raisedHands.clear();
    
    // Remove socket listeners
    if (this.socket) {
      this.socket.off('reaction-received');
      this.socket.off('hand-raised');
      this.socket.off('hand-lowered');
      this.socket.off('participants-with-raised-hands');
    }
  }
}

// Safe export that doesn't override existing globals
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReactionManager;
} else {
  // Only set global if it doesn't exist
  if (!window.ReactionManager) {
    window.ReactionManager = ReactionManager;
  }
}