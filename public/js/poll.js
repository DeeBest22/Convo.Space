// Client state
let USER = {
  id: localStorage.getItem('userId') || 'user-' + Math.random().toString(36).substr(2, 9),
  isHost: false
};

// Save user ID for persistent identity
localStorage.setItem('userId', USER.id);

// Current room info
let ROOM_ID = 'default-room'; // Default room ID
let currentParticipants = [];
let activePolls = [];
let endedPolls = [];
let userVotes = new Map(); // Track user's votes for each poll
let pollTimers = new Map(); // Track active timers for each poll

// DOM Elements
const appContainer = document.querySelector('.app-container');
const videoGrid = document.querySelector('.video-grid-poll');
const createPollBtn = document.getElementById('create-poll-btn');
const viewPollsBtn = document.createElement('button'); // New button for viewing polls
const pollCreationpoller = document.getElementById('poll-creation-poller');
const activePollpoller = document.getElementById('active-poll-poller');
const pollForm = document.getElementById('poll-form');
const addOptionBtn = document.getElementById('add-option-btn');
const optionsContainer = document.getElementById('options-container');
const pollOptionsContainer = document.getElementById('poll-options-container');
const pollResultsContainer = document.getElementById('poll-results-container');
const pollTitle = document.getElementById('poll-title');
const hostPollControls = document.getElementById('host-poll-controls');
const endPollBtn = document.getElementById('end-poll-btn');
const minimizedPollIndicator = document.getElementById('minimized-poll-indicator');
const userVoteStatus = document.getElementById('user-vote-status');
const userVoteOption = document.getElementById('user-vote-option');
const pollTimer = document.getElementById('poll-timer');

// Connect to Socket.IO server
const socket = io();

// Initialize App
function init() {
  // Create the View Polls button
  setupViewPollsButton();
  
  // Directly join room without prompting for username
  joinRoom();

  // Set up event listeners
  setupEventListeners();
}

// Create and add the View Polls button to the meeting controls
function setupViewPollsButton() {
  viewPollsBtn.className = 'control-btn view-polls-btn';
  viewPollsBtn.innerHTML = '<i class="fas fa-list-ul"></i> View Polls';
  viewPollsBtn.style.width = 'auto';
  viewPollsBtn.style.borderRadius = '28px';
  viewPollsBtn.style.padding = '0 24px';
  viewPollsBtn.style.marginLeft = '8px';
  
  // Add the button next to the Create Poll button
  const meetingControls = document.querySelector('.meeting-controls-poll');
  meetingControls.appendChild(viewPollsBtn);
  
  // Hide the floating indicator since we now have a permanent button
  minimizedPollIndicator.classList.add('hidden');
}

// Join a room
function joinRoom() {

  fetch('/api/rooms/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      roomId: ROOM_ID,
      userId: USER.id
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      USER.isHost = data.isHost;
      currentParticipants = data.participants;
      activePolls = data.activePolls || [];
      endedPolls = data.endedPolls || [];
      createPollBtn.style.display = 'flex';
      updateParticipantsView();
      updatePollsCounter(); // Update the counter on the View Polls button
      socket.emit('join-room', {
        roomId: ROOM_ID,
        userId: USER.id
      });
    } else {
      alert('Failed to join room: ' + (data.error || 'Unknown error'));
    }
  })
  .catch(error => {
    console.error('Error joining room:', error);
    alert('Error connecting to the server. Please try again.');
  });
}

// Update participants list in the UI
function updateParticipantsView() {
  videoGrid.innerHTML = '';
  const localContainer = createParticipantElement(USER.id, 'Anonymous', true);
  videoGrid.appendChild(localContainer);
  currentParticipants.forEach(participant => {
    if (participant.id !== USER.id) {
      const participantElement = createParticipantElement(participant.id, participant.username || 'Anonymous', participant.isOnline);
      videoGrid.appendChild(participantElement);
    }
  });
}

// Create a participant element
function createParticipantElement(userId, displayName, isOnline) {
  const container = document.createElement('div');
  container.className = 'video-container-poll';
  container.dataset.userId = userId;
  const statusClass = isOnline ? 'online' : 'offline';
  container.innerHTML = `
    <div class="user-name">${displayName} ${userId === USER.id ? '(You)' : ''}</div>
    <div class="status-indicator ${statusClass}"></div>
  `;
  return container;
}

// Update the counter on the View Polls button
function updatePollsCounter() {
  const activeCount = activePolls.length;
  const totalCount = activePolls.length + endedPolls.length;
  
  if (activeCount > 0) {
    viewPollsBtn.innerHTML = `<i class="fas fa-list-ul"></i> Polls (${activeCount} Active)`;
    viewPollsBtn.classList.add('has-active-polls');
  } else if (totalCount > 0) {
    viewPollsBtn.innerHTML = `<i class="fas fa-list-ul"></i> Polls (${totalCount})`;
    viewPollsBtn.classList.remove('has-active-polls');
  } else {
    viewPollsBtn.innerHTML = `<i class="fas fa-list-ul"></i> Polls`;
    viewPollsBtn.classList.remove('has-active-polls');
  }
}

// Set up event listeners
function setupEventListeners() {
  createPollBtn.addEventListener('click', () => showpoller(pollCreationpoller));
  viewPollsBtn.addEventListener('click', showPollSelectionpoller);
  addOptionBtn.addEventListener('click', addPollOption);
  pollForm.addEventListener('submit', handlePollSubmission);
  endPollBtn.addEventListener('click', function() {
    const pollId = this.dataset.pollId;
    if (pollId) {
      socket.emit('end-poll', {
        roomId: ROOM_ID,
        userId: USER.id,
        pollId: pollId
      });
    }
  });
  
  document.querySelectorAll('.close-poller-poll').forEach(button => {
    button.addEventListener('click', function() {
      const poller = this.closest('.poller');
      hidepoller(poller);
    });
  });
  document.querySelector('.cancel-btn').addEventListener('click', () => {
    hidepoller(pollCreationpoller);
    resetPollForm();
  });
  socket.on('user-joined', handleUserJoined);
  socket.on('user-left', handleUserLeft);
  socket.on('poll-created', handlePollCreated);
  socket.on('poll-updated', debounce(handlePollUpdated, 100));
  socket.on('poll-ended', handlePollEnded);
  socket.on('user-activity', handleUserActivity);
  socket.on('error', handleError);
}

// Debounce function to prevent jittery animations
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// User joined handler
function handleUserJoined(data) {
  currentParticipants = data.participants;
  updateParticipantsView();
}

// User left handler
function handleUserLeft(data) {
  currentParticipants = data.participants;
  updateParticipantsView();
}

// User activity handler
function handleUserActivity(data) {
  const participantElement = document.querySelector(`.video-container-poll[data-user-id="${data.userId}"]`);
  if (participantElement) {
    const statusIndicator = participantElement.querySelector('.status-indicator');
    if (data.activity === 'typing') {
      statusIndicator.classList.add('typing');
      setTimeout(() => statusIndicator.classList.remove('typing'), 3000);
    }
  }
}

// Poll Creation Functions
function addPollOption() {
  const optionInputs = document.querySelectorAll('.poll-option');
  if (optionInputs.length >= 10) {
    showError('Maximum 10 options allowed');
    return;
  }
  const newOption = document.createElement('div');
  newOption.className = 'option-input';
  newOption.innerHTML = `
    <input type="text" class="poll-option" placeholder="Option ${optionInputs.length + 1}" required>
    <button type="button" class="remove-option">×</button>
  `;
  const optionsGroup = document.querySelector('#options-container .form-group');
  optionsGroup.appendChild(newOption);
  newOption.querySelector('.remove-option').addEventListener('click', function() {
    this.parentElement.remove();
  });
}

// Add multi-select option to form
function enhancePollForm() {
  if (!document.getElementById('multi-select')) {
    const multiSelectGroup = document.createElement('div');
    multiSelectGroup.className = 'form-group checkbox-group';
    multiSelectGroup.innerHTML = `
      <input type="checkbox" id="multi-select">
      <label for="multi-select">Allow multiple selections</label>
    `;
    const maxSelectionsGroup = document.createElement('div');
    maxSelectionsGroup.className = 'form-group max-selections hidden';
    maxSelectionsGroup.innerHTML = `
      <label for="max-selections">Maximum selections allowed:</label>
      <input type="number" id="max-selections" min="1" value="2">
    `;
    const anonymousGroup = document.querySelector('.checkbox-group');
    anonymousGroup.parentNode.insertBefore(multiSelectGroup, anonymousGroup.nextSibling);
    multiSelectGroup.parentNode.insertBefore(maxSelectionsGroup, multiSelectGroup.nextSibling);
    document.getElementById('multi-select').addEventListener('change', function() {
      maxSelectionsGroup.classList.toggle('hidden', !this.checked);
    });
  }
}

function handlePollSubmission(e) {
  e.preventDefault();
  socket.emit('user-typing', { roomId: ROOM_ID, userId: USER.id });
  const question = document.getElementById('poll-question').value;
  const optionInputs = document.querySelectorAll('.poll-option');
  const options = Array.from(optionInputs).map(input => input.value);
  const isAnonymous = document.getElementById('anonymous-voting').checked;
  const duration = parseInt(document.getElementById('poll-duration').value);
  const isMultiSelect = document.getElementById('multi-select')?.checked || false;
  const maxSelections = isMultiSelect ? parseInt(document.getElementById('max-selections')?.value || 2) : 1;
  if (!question.trim()) {
    showError('Question is required');
    return;
  }
  if (options.length < 2) {
    showError('At least 2 options are required');
    return;
  }
  if (options.some(option => !option.trim())) {
    showError('All options must have a value');
    return;
  }
  socket.emit('create-poll', {
    roomId: ROOM_ID,
    userId: USER.id,
    pollData: {
      question,
      options,
      isAnonymous,
      isMultiSelect,
      maxSelections,
      duration: isNaN(duration) ? 120 : duration
    }
  });
  hidepoller(pollCreationpoller);
  resetPollForm();
}

function resetPollForm() {
  pollForm.reset();
  const optionInputs = document.querySelectorAll('.option-input');
  for (let i = 2; i < optionInputs.length; i++) {
    optionInputs[i].remove();
  }
}

// Show poll selection poller
function showPollSelectionpoller() {
  if (activePolls.length === 0 && endedPolls.length === 0) {
    alert('No polls available. Create a poll first!');
    return;
  }

  if (!document.getElementById('poll-selection-poller')) {
    const selectionpoller = document.createElement('div');
    selectionpoller.id = 'poll-selection-poller';
    selectionpoller.className = 'poller';
    selectionpoller.innerHTML = `
      <div class="poller-content-poll">
        <div class="poller-header-poll">
          <h2>Polls</h2>
          <span class="close-poller-poll">×</span>
        </div>
        <div class="poller-body-poll">
          <div class="poll-tabs">
            <button class="tab-btn active" data-tab="active-polls">Active Polls</button>
            <button class="tab-btn" data-tab="ended-polls">Ended Polls</button>
          </div>
          <div id="active-polls" class="poll-tab-content active">
            <div id="active-polls-list"></div>
          </div>
          <div id="ended-polls" class="poll-tab-content">
            <div id="ended-polls-list"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(selectionpoller);
    selectionpoller.querySelector('.close-poller-poll').addEventListener('click', () => hidepoller(selectionpoller));
    selectionpoller.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectionpoller.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        selectionpoller.querySelectorAll('.poll-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabContent = selectionpoller.querySelector(`#${btn.dataset.tab}`);
        tabContent.classList.add('active');
      });
    });
  }
  
  updatePollSelectionLists();
  showpoller(document.getElementById('poll-selection-poller'));
}

// Update the poll selection lists
function updatePollSelectionLists() {
  const activePollsList = document.getElementById('active-polls-list');
  const endedPollsList = document.getElementById('ended-polls-list');
  
  // Update active polls list
  activePollsList.innerHTML = activePolls.length ? '' : '<p>No active polls</p>';
  activePolls.forEach(poll => {
    const pollItem = document.createElement('div');
    pollItem.className = 'poll-selection-item';
    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
    const hasVoted = poll.voters[USER.id] ? true : false;
    pollItem.innerHTML = `
      <div class="poll-item-header">
        <div class="poll-selection-question">${poll.question}</div>
        <div class="poll-selection-meta">
          <div class="poll-creator">Created by: ${poll.creatorId === USER.id ? 'You' : 'Anonymous'}</div>
          <div class="poll-votes">${totalVotes} vote${totalVotes !== 1 ? 's' : ''}</div>
        </div>
        ${hasVoted ? '<div class="poll-voted-badge">You voted</div>' : ''}
      </div>
    `;
    pollItem.addEventListener('click', () => {
      hidepoller(document.getElementById('poll-selection-poller'));
      displayPoll(poll);
    });
    activePollsList.appendChild(pollItem);
  });
  
  // Update ended polls list
  endedPollsList.innerHTML = endedPolls.length ? '' : '<p>No ended polls</p>';
  endedPolls.forEach(poll => {
    const pollItem = document.createElement('div');
    pollItem.className = 'poll-selection-item';
    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
    const hasVoted = poll.voters[USER.id] ? true : false;
    pollItem.innerHTML = `
      <div class="poll-item-header">
        <div class="poll-selection-question">${poll.question}</div>
        <div class="poll-selection-meta">
          <div class="poll-creator">Created by: ${poll.creatorId === USER.id ? 'You' : 'Anonymous'}</div>
          <div class="poll-votes">${totalVotes} vote${totalVotes !== 1 ? 's' : ''}</div>
        </div>
        ${hasVoted ? '<div class="poll-voted-badge">You voted</div>' : ''}
      </div>
    `;
    pollItem.addEventListener('click', () => {
      hidepoller(document.getElementById('poll-selection-poller'));
      displayPoll(poll);
    });
    endedPollsList.appendChild(pollItem);
  });
}

// Poll Display and Voting Functions
function handlePollCreated(poll) {
  const pollIndex = activePolls.findIndex(p => p.id === poll.id);
  if (pollIndex === -1) {
    activePolls.push(poll);
  } else {
    activePolls[pollIndex] = poll;
  }
  updatePollsCounter();
  displayPoll(poll);
}

function displayPoll(poll) {
  pollTitle.textContent = poll.question;
  pollOptionsContainer.innerHTML = '';
  pollResultsContainer.innerHTML = '';
  userVoteStatus.classList.add('hidden');
  endPollBtn.dataset.pollId = poll.id;
  if (poll.active) {
    const isMultiSelect = poll.isMultiSelect || false;
    renderPollOptions(poll, isMultiSelect);
    showpoller(activePollpoller);
    if (USER.isHost || poll.creatorId === USER.id) {
      hostPollControls.classList.remove('hidden');
    } else {
      hostPollControls.classList.add('hidden');
    }
    if (poll.endTime) {
      startPollTimer(poll.id, poll.endTime);
    }
  } else {
    renderPollResults(poll);
    showpoller(activePollpoller);
    hostPollControls.classList.add('hidden');
  }
}

function renderPollOptions(poll, isMultiSelect) {
  pollOptionsContainer.innerHTML = '';
  pollResultsContainer.classList.add('hidden');
  pollOptionsContainer.classList.remove('hidden');
  const userVoteData = poll.voters[USER.id];
  if (userVoteData) {
    userVoteStatus.classList.remove('hidden');
    if (isMultiSelect && userVoteData.selectedOptions.length > 0) {
      const votedOptions = userVoteData.selectedOptions.map(idx => poll.options[idx].text).join(', ');
      userVoteOption.textContent = votedOptions;
    } else if (userVoteData.selectedOptions.length === 1) {
      userVoteOption.textContent = poll.options[userVoteData.selectedOptions[0]].text;
    }
  } else {
    userVoteStatus.classList.add('hidden');
  }
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
  poll.options.forEach((option, index) => {
    const percentage = totalVotes > 0 ? (option.votes / totalVotes * 100).toFixed(1) : 0;
    let optionBtn = pollOptionsContainer.querySelector(`.poll-option-btn[data-index="${index}"], .poll-option-checkbox[data-index="${index}"]`);
    if (!optionBtn) {
      optionBtn = document.createElement('div');
      optionBtn.dataset.index = index;
      pollOptionsContainer.appendChild(optionBtn);
    }
    if (isMultiSelect) {
      optionBtn.className = 'poll-option-checkbox';
      const isChecked = userVoteData && userVoteData.selectedOptions.includes(index) ? 'checked' : '';
      optionBtn.innerHTML = `
        <label class="checkbox-container">
          <input type="checkbox" data-index="${index}" class="option-checkbox" ${isChecked}>
          <span class="checkbox-text">${option.text}</span>
          ${!poll.isAnonymous ? `<span class="vote-percentage" data-percentage="${percentage}">${percentage}%</span>` : ''}
        </label>
      `;
    } else {
      optionBtn.className = 'poll-option-btn';
      optionBtn.innerHTML = `
        <span>${option.text}</span>
        ${!poll.isAnonymous ? `<span class="vote-percentage" data-percentage="${percentage}">${percentage}%</span>` : ''}
      `;
      if (userVoteData && userVoteData.selectedOptions.includes(index)) {
        optionBtn.classList.add('selected');
      } else {
        optionBtn.classList.remove('selected');
      }
    }
  });
  if (isMultiSelect) {
    const checkboxes = pollOptionsContainer.querySelectorAll('.option-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const selectedCheckboxes = pollOptionsContainer.querySelectorAll('.option-checkbox:checked');
        if (selectedCheckboxes.length > poll.maxSelections) {
          checkbox.checked = false;
          showError(`You can only select up to ${poll.maxSelections} options`);
        }
      });
    });
    let submitBtn = pollOptionsContainer.querySelector('.primary-btn');
    if (!submitBtn) {
      submitBtn = document.createElement('button');
      submitBtn.className = 'primary-btn';
      pollOptionsContainer.appendChild(submitBtn);
    }
    submitBtn.textContent = userVoteData ? 'Update Vote' : 'Submit Vote';
    submitBtn.onclick = () => {
      const selectedCheckboxes = pollOptionsContainer.querySelectorAll('.option-checkbox:checked');
      const selectedOptions = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.index));
      if (selectedOptions.length === 0) {
        showError('Please select at least one option');
        return;
      }
      submitVote(poll.id, selectedOptions);
    };
  } else {
    const optionButtons = pollOptionsContainer.querySelectorAll('.poll-option-btn');
    optionButtons.forEach(btn => {
      btn.onclick = () => submitVote(poll.id, [parseInt(btn.dataset.index)]);
    });
  }
}

function renderPollResults(poll) {
  pollResultsContainer.classList.remove('hidden');
  pollOptionsContainer.classList.add('hidden');
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
  poll.options.forEach((option, index) => {
    const percentage = totalVotes > 0 ? (option.votes / totalVotes * 100).toFixed(1) : 0;
    let resultItem = pollResultsContainer.querySelector(`.poll-result-item[data-index="${index}"]`);
    if (!resultItem) {
      resultItem = document.createElement('div');
      resultItem.className = 'poll-result-item';
      resultItem.dataset.index = index;
      pollResultsContainer.appendChild(resultItem);
    }
    resultItem.innerHTML = `
      <div class="poll-result-text">
        <span>${option.text}</span>
        <span class="vote-count" data-votes="${option.votes}">${option.votes} vote${option.votes !== 1 ? 's' : ''} (${percentage}%)</span>
      </div>
      <div class="poll-result-bar">
        <div class="poll-result-progress" style="width: ${percentage}%"></div>
      </div>
    `;
  });
}

function submitVote(pollId, selectedOptions) {
  socket.emit('submit-vote', {
    roomId: ROOM_ID,
    userId: USER.id,
    pollId,
    selectedOptions
  });
  userVotes.set(pollId, selectedOptions);
}

function handlePollUpdated(poll) {
  const activePollIndex = activePolls.findIndex(p => p.id === poll.id);
  const endedPollIndex = endedPolls.findIndex(p => p.id === poll.id);
  if (poll.active && activePollIndex === -1) {
    activePolls.push(poll);
  } else if (poll.active) {
    activePolls[activePollIndex] = poll;
  } else if (!poll.active && endedPollIndex === -1) {
    endedPolls.push(poll);
  } else if (!poll.active) {
    endedPolls[endedPollIndex] = poll;
  }
  
  updatePollsCounter();
  
  if (activePollpoller.classList.contains('show') && endPollBtn.dataset.pollId === poll.id) {
    displayPoll(poll);
  }
}

function handlePollEnded(data) {
  const pollIndex = activePolls.findIndex(p => p.id === data.pollId);
  if (pollIndex !== -1) {
    const poll = data.poll;
    activePolls.splice(pollIndex, 1);
    endedPolls.push(poll);
    if (activePollpoller.classList.contains('show') && endPollBtn.dataset.pollId === data.pollId) {
      displayPoll(poll);
    }
    clearPollTimer(data.pollId);
    updatePollsCounter();
  }
}

function startPollTimer(pollId, endTime) {
  clearPollTimer(pollId);
  const updateTimer = () => {
    const timeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    if (timeLeft > 0) {
      pollTimer.textContent = `Time left: ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`;
      const timeoutId = setTimeout(updateTimer, 1000);
      pollTimers.set(pollId, timeoutId);
    } else {
      pollTimer.textContent = 'Poll ended';
      clearPollTimer(pollId);
    }
  };
  updateTimer();
}

function clearPollTimer(pollId) {
  const timeoutId = pollTimers.get(pollId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    pollTimers.delete(pollId);
  }
}

// Utility Functions
function showpoller(poller) {
  poller.classList.add('show');
}

function hidepoller(poller) {
  poller.classList.remove('show');
}

function showError(message) {
  alert(message);
}

function handleError(data) {
  showError(data.message);
}

// Add a style for the active polls indicator
function addStyles() {
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .view-polls-btn {
      transition: all 0.3s ease;
    }
    
    .has-active-polls {
      background: linear-gradient(135deg, #10b981, #059669) !important;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
      }
    }
  `;
  document.head.appendChild(styleEl);
}

// Initialize the app
enhancePollForm();
addStyles();
init();