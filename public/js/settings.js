// Wait for DOM to be fully loaded before executing script
document.addEventListener('DOMContentLoaded', function() {
  // Settings modal functionality
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modalForSettings') || document.getElementById('settings-modal');
  const closeSettings = document.getElementById('close-settings');
  const saveSettings = document.getElementById('save-settings');
  const resetSettings = document.getElementById('reset-settings');
  const navItems = document.querySelectorAll('.nav-item');
  const settingsTabs = document.querySelectorAll('.settings-tab');
  
  // Only add event listeners if elements exist
  if (settingsBtn && settingsModal) {
    // Open settings modal
    settingsBtn.addEventListener('click', () => {
      settingsModal.classList.add('show');
      document.body.style.overflow = 'hidden';
    });
  }
  
  if (closeSettings && settingsModal) {
    // Close settings modal
    closeSettings.addEventListener('click', () => {
      settingsModal.classList.remove('show');
      document.body.style.overflow = 'auto';
      
      // Fix for extra space - remove any inline styles that might be causing issues
      document.body.style.paddingRight = '';
      document.body.style.marginRight = '';
    });
  }
  
  // Tab navigation
  if (navItems.length > 0 && settingsTabs.length > 0) {
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        // Remove active class from all items
        navItems.forEach(i => i.classList.remove('active'));
        settingsTabs.forEach(tab => tab.classList.remove('active'));
        
        // Add active class to clicked item
        item.classList.add('active');
        
        // Show corresponding tab
        const tabId = item.getAttribute('data-tab');
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
          targetTab.classList.add('active');
        }
      });
    });
  }
  
  // Save settings
  if (saveSettings && settingsModal) {
    saveSettings.addEventListener('click', () => {
      // Show feedback toast
      const toast = document.createElement('div');
      toast.className = 'toast-notification';
      toast.innerHTML = '<i class="fas fa-check-circle"></i> Settings saved successfully!';
      document.body.appendChild(toast);
      
      // Close modal after showing toast
      setTimeout(() => {
        settingsModal.classList.remove('show');
        document.body.style.overflow = 'auto';
        // Fix for extra space
        document.body.style.paddingRight = '';
        document.body.style.marginRight = '';
      }, 1000);
      
      // Remove toast after animation
      setTimeout(() => {
        toast.remove();
      }, 3000);
    });
  }
  
  // Reset settings
  if (resetSettings) {
    resetSettings.addEventListener('click', () => {
      // Show confirmation dialog
      if (confirm('Are you sure you want to reset all settings to default?')) {
        // Show feedback toast
        const toast = document.createElement('div');
        toast.className = 'toast-notification warning';
        toast.innerHTML = '<i class="fas fa-sync-alt"></i> Settings reset to default!';
        document.body.appendChild(toast);
        
        // Remove toast after animation
        setTimeout(() => {
          toast.remove();
        }, 3000);
      }
    });
  }
  
  // Simulate audio meter animation
  const meterBar = document.querySelector('.meter-bar');
  const testMicBtn = document.querySelector('.audio-test .test-btn');
  
  if (meterBar && testMicBtn) {
    testMicBtn.addEventListener('click', () => {
      testMicBtn.textContent = 'Testing...';
      testMicBtn.disabled = true;
      
      let level = 0;
      const interval = setInterval(() => {
        level = Math.random() * 100;
        meterBar.style.width = level + '%';
        
        if (level < 30) {
          meterBar.style.backgroundColor = '#4caf50';
        } else if (level < 70) {
          meterBar.style.backgroundColor = '#ff9800';
        } else {
          meterBar.style.backgroundColor = '#f44336';
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(interval);
        meterBar.style.width = '0%';
        testMicBtn.textContent = 'Test Microphone';
        testMicBtn.disabled = false;
      }, 3000);
    });
  }
  
  // Video test button functionality
  const testVideoBtn = document.querySelector('.video-preview .test-btn');
  const videoMonitor = document.querySelector('.video-monitor');
  
  if (testVideoBtn && videoMonitor) {
    testVideoBtn.addEventListener('click', () => {
      if (videoMonitor.classList.contains('active')) {
        videoMonitor.classList.remove('active');
        videoMonitor.innerHTML = '<i class="fas fa-user"></i>';
        testVideoBtn.textContent = 'Test Video';
      } else {
        videoMonitor.classList.add('active');
        videoMonitor.innerHTML = '<img src="/api/placeholder/320/240" alt="Video preview">';
        testVideoBtn.textContent = 'Stop Test';
      }
    });
  }
  
  // Background options selection
  const bgOptions = document.querySelectorAll('.bg-option');
  
  if (bgOptions.length > 0) {
    bgOptions.forEach(option => {
      option.addEventListener('click', () => {
        bgOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
      });
    });
  }
  
  // Option buttons selection
  const optionBtns = document.querySelectorAll('.option-btn');
  
  if (optionBtns.length > 0) {
    optionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Only apply to buttons in the same group
        const parent = btn.parentElement;
        if (parent) {
          parent.querySelectorAll('.option-btn').forEach(b => {
            b.classList.remove('active');
          });
          btn.classList.add('active');
        }
      });
    });
  }
  
  // Toggle functionality for mute/unmute
  const muteToggle = document.getElementById('mute-toggle');
  const micBtn = document.querySelector('.control-bar .control-btn:first-child');
  
  if (muteToggle && micBtn) {
    muteToggle.addEventListener('change', () => {
      if (muteToggle.checked) {
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        micBtn.classList.remove('muted');
      } else {
        micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        micBtn.classList.add('muted');
      }
    });
  }
  
  // Toggle functionality for video
  const videoToggle = document.getElementById('video-toggle');
  const videoBtn = document.querySelector('.control-bar .control-btn:nth-child(2)');
  
  if (videoToggle && videoBtn) {
    videoToggle.addEventListener('change', () => {
      if (videoToggle.checked) {
        videoBtn.innerHTML = '<i class="fas fa-video"></i>';
        videoBtn.classList.remove('disabled');
      } else {
        videoBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
        videoBtn.classList.add('disabled');
      }
    });
  }
  
  // Clean up any body styles when the modal is closed by clicking outside
  window.addEventListener('click', function(e) {
    if (settingsModal && e.target === settingsModal) {
      settingsModal.classList.remove('show');
      document.body.style.overflow = 'auto';
      // Fix for extra space
      document.body.style.paddingRight = '';
      document.body.style.marginRight = '';
    }
  });
  
  // Clean up on escape key
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && settingsModal && settingsModal.classList.contains('show')) {
      settingsModal.classList.remove('show');
      document.body.style.overflow = 'auto';
      // Fix for extra space
      document.body.style.paddingRight = '';
      document.body.style.marginRight = '';
    }
  });
});