document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const notesBtn = document.getElementById('notesBtn');
    const notesOverlay = document.getElementById('notesOverlay');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const newNoteBtn = document.getElementById('newNoteBtn');
    const notesList = document.getElementById('notesList');
    const emptyState = document.getElementById('emptyState');
    const notesListView = document.getElementById('notesListView');
    const noteEditorView = document.getElementById('noteEditorView');
    const noteTitle = document.getElementById('noteTitle');
    const noteContent = document.getElementById('noteContent');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const noteToast = document.getElementById('noteToast');
    const noteToastMessage = document.getElementById('noteToastMessage');
    const themeToggle = document.getElementById('themeToggle');
    const darkModeBtn = document.getElementById('darkModeBtn');
    
    // State
    let notes = [];
    let currentNoteId = null;
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    // Initialize
    init();
    
    // Functions
    function init() {
      loadNotes();
      renderNotesList();
      setupEventListeners();
      checkDarkMode();
    }
    
    function setupEventListeners() {
      // Open/close modal
      notesBtn.addEventListener('click', openModal);
      closeModalBtn.addEventListener('click', closeModal);
      notesOverlay.addEventListener('click', (e) => {
        if (e.target === notesOverlay) closeModal();
      });
      
      // Note actions
      newNoteBtn.addEventListener('click', createNewNote);
      saveNoteBtn.addEventListener('click', saveNote);
      cancelEditBtn.addEventListener('click', cancelEdit);
      
      // Dark mode toggle
      themeToggle.addEventListener('click', toggleDarkMode);
      darkModeBtn.addEventListener('click', toggleDarkMode);
    }
    
    function openModal() {
      notesOverlay.classList.add('modal-visible');
      renderNotesList();
    }
    
    function closeModal() {
      notesOverlay.classList.remove('modal-visible');
      showListView();
    }
    
    function loadNotes() {
      const savedNotes = localStorage.getItem('notes');
      if (savedNotes) {
        notes = JSON.parse(savedNotes);
      }
    }
    
    function saveNotesToStorage() {
      localStorage.setItem('notes', JSON.stringify(notes));
    }
    
    function renderNotesList() {
      notesList.innerHTML = '';
      
      if (notes.length === 0) {
        emptyState.style.display = 'block';
        return;
      }
      
      emptyState.style.display = 'none';
      
      // Sort notes by last modified date (newest first)
      const sortedNotes = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
      
      sortedNotes.forEach(note => {
        const noteCard = createNoteCard(note);
        notesList.appendChild(noteCard);
      });
    }
    
    function createNoteCard(note) {
      const div = document.createElement('div');
      div.className = 'note-card';
      div.setAttribute('data-id', note.id);
      
      const formattedDate = new Date(note.updatedAt).toLocaleString();
      
      div.innerHTML = `
        <h3 class="note-title">${escapeHtml(note.title)}</h3>
        <div class="note-content">${escapeHtml(note.content)}</div>
        <div class="note-date">${formattedDate}</div>
        <div class="card-actions">
          <button class="action-btn edit" aria-label="Edit note">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="action-btn download" aria-label="Download note">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button class="action-btn delete" aria-label="Delete note">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        </div>
      `;
      
      // Add event listeners
      div.querySelector('.action-btn.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        editNote(note.id);
      });
      
      div.querySelector('.action-btn.download').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadNote(note);
      });
      
      div.querySelector('.action-btn.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(note.id);
      });
      
      // Open note on card click
      div.addEventListener('click', () => {
        editNote(note.id);
      });
      
      return div;
    }
    
    function createNewNote() {
      currentNoteId = null;
      noteTitle.value = '';
      noteContent.value = '';
      showEditorView();
    }
    
    function editNote(id) {
      const note = notes.find(note => note.id === id);
      if (!note) return;
      
      currentNoteId = id;
      noteTitle.value = note.title;
      noteContent.value = note.content;
      showEditorView();
    }
    
    function saveNote() {
      const title = noteTitle.value.trim();
      const content = noteContent.value.trim();
      
      if (!title) {
        shownoteToast('Please enter a title for your note', true);
        return;
      }
      
      const now = Date.now();
      
      if (currentNoteId) {
        // Update existing note
        const index = notes.findIndex(note => note.id === currentNoteId);
        if (index !== -1) {
          notes[index] = {
            ...notes[index],
            title,
            content,
            updatedAt: now
          };
        }
      } else {
        // Create new note
        const newNote = {
          id: generateId(),
          title,
          content,
          createdAt: now,
          updatedAt: now
        };
        notes.push(newNote);
      }
      
      saveNotesToStorage();
      shownoteToast('Note saved successfully!');
      showListView();
      renderNotesList();
    }
    
    function deleteNote(id) {
      if (confirm('Are you sure you want to delete this note?')) {
        notes = notes.filter(note => note.id !== id);
        saveNotesToStorage();
        shownoteToast('Note deleted');
        renderNotesList();
      }
    }
    
    function downloadNote(note) {
      const content = `${note.title}\n\n${note.content}`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${note.title.replace(/[^\w\s]/gi, '')}.txt`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      shownoteToast('Note downloaded');
    }
    
    function cancelEdit() {
      showListView();
    }
    
    function showEditorView() {
      notesListView.style.display = 'none';
      noteEditorView.style.display = 'flex';
      noteTitle.focus();
    }
    
    function showListView() {
      notesListView.style.display = 'block';
      noteEditorView.style.display = 'none';
    }
    
    function shownoteToast(message, isError = false) {
      noteToastMessage.textContent = message;
      noteToast.className = isError ? 'noteToast error' : 'noteToast';
      noteToast.classList.add('show');
      
      setTimeout(() => {
        noteToast.classList.remove('show');
      }, 3000);
    }
    
    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function toggleDarkMode() {
      isDarkMode = !isDarkMode;
      checkDarkMode();
      localStorage.setItem('darkMode', isDarkMode);
    }
    
    function checkDarkMode() {
      if (isDarkMode) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    }
  });