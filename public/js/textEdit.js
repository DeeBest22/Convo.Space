document.addEventListener("DOMContentLoaded", () => {
    // Emoji Data
    const emojiData = {
        people: [
            { char: '😀', name: 'grinning', keywords: ['happy', 'smile'] },
            { char: '😊', name: 'blush', keywords: ['happy', 'shy'] },
            { char: '😎', name: 'sunglasses', keywords: ['cool', 'sun'] },
            { char: '🥳', name: 'party', keywords: ['celebration', 'party'] }
        ],
        animals: [
            { char: '🐶', name: 'dog', keywords: ['puppy', 'pet'] },
            { char: '🐱', name: 'cat', keywords: ['kitten', 'pet'] },
            { char: '🦁', name: 'lion', keywords: ['king', 'jungle'] },
            { char: '🐼', name: 'panda', keywords: ['china', 'bear'] }
        ],
        food: [
            { char: '🍎', name: 'apple', keywords: ['fruit', 'healthy'] },
            { char: '🍕', name: 'pizza', keywords: ['food', 'italian'] },
            { char: '🍔', name: 'burger', keywords: ['fastfood', 'meal'] },
            { char: '🍩', name: 'donut', keywords: ['sweet', 'dessert'] }
        ],
        travel: [
            { char: '✈️', name: 'plane', keywords: ['flight', 'travel'] },
            { char: '🚗', name: 'car', keywords: ['vehicle', 'drive'] },
            { char: '⛵', name: 'sailboat', keywords: ['boat', 'water'] },
            { char: '🚲', name: 'bicycle', keywords: ['bike', 'cycle'] }
        ],
        activities: [
            { char: '⚽', name: 'soccer', keywords: ['football', 'sport'] },
            { char: '🎮', name: 'videogame', keywords: ['gaming', 'controller'] },
            { char: '🎸', name: 'guitar', keywords: ['music', 'instrument'] },
            { char: '🎭', name: 'theater', keywords: ['drama', 'mask'] }
        ]
    };

    // DOM Elements
    const picker = document.querySelector('.emoji-picker');
    const trigger = document.querySelector('.emoji-trigger');
    const searchInput = document.querySelector('.emoji-search');
    const categories = document.querySelectorAll('.emoji-category');
    const emojiContainer = document.getElementById('emoji-container');
    let currentCategory = 'all';

    // Iframe elements
    const hiddenInput = document.getElementById('hidden-input');
    const iframe = document.getElementById('chat-input');
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    // Initialize iframe editor
    iframe.style.display = 'block';
    iframe.style.width = '100%';
    iframe.style.height = '150px';
    iframe.style.border = 'none';
    hiddenInput.style.display = 'none';

    // Initialize iframe content
    iframeDoc.open();
    iframeDoc.write(`
        <html>
        <head>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 15px;
                    min-height: 100%;
                    color: #333;
                    font-size: 16px;
                    line-height: 1.6;
                }
                body:focus {
                    outline: none;
                }
                ul, ol {
                    margin-left: 20px;
                    padding-left: 20px;
                }
                blockquote {
                    border-left: 3px solid #ccc;
                    margin-left: 0;
                    padding-left: 15px;
                    color: #666;
                }
                code {
                    background-color: #f8f9fa;
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-family: monospace;
                    font-size: 0.9em;
                }
                h1, h2, h3, h4, h5, h6 {
                    margin-top: 10px;
                    margin-bottom: 10px;
                }
            </style>
        </head>
        <body id="editor-content" contenteditable="true"></body>
        </html>
    `);
    iframeDoc.close();

    // Emoji Picker Functions
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        picker.classList.toggle('active');
        positionPicker();
        focusEditorEnd();
    });

    function positionPicker() {
        const rect = trigger.getBoundingClientRect();
        picker.style.top = `${-295}px`;
        picker.style.left = `${-40}px`;
    }

    function focusEditorEnd() {
        const selection = iframeDoc.getSelection();
        const range = iframeDoc.createRange();
        range.selectNodeContents(iframeDoc.body);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    document.addEventListener('click', (e) => {
        if (!picker.contains(e.target) && e.target !== trigger) {
            picker.classList.remove('active');
        }
    });

    categories.forEach(category => {
        category.addEventListener('click', (e) => {
            e.stopPropagation();
            categories.forEach(c => c.classList.remove('active'));
            category.classList.add('active');
            currentCategory = category.dataset.category;
            renderEmojis(searchInput.value.toLowerCase());
        });
    });

    searchInput.addEventListener('input', (e) => {
        renderEmojis(e.target.value.toLowerCase());
    });

    function renderEmojis(searchTerm = '') {
        emojiContainer.innerHTML = '';
        
        let filteredEmojis = [];
        let categoriesToSearch;
    
        if (searchTerm) {
            // Search all categories when there's a search term
            categoriesToSearch = Object.keys(emojiData);
        } else {
            // Respect the current category when no search term
            categoriesToSearch = currentCategory === 'all' 
                ? Object.keys(emojiData) 
                : [currentCategory];
        }
    
        categoriesToSearch.forEach(category => {
            filteredEmojis.push(...emojiData[category].filter(emoji => {
                return searchTerm === '' || 
                    emoji.name.includes(searchTerm) || 
                    emoji.keywords.some(k => k.includes(searchTerm));
            }));
        });
    
        if (filteredEmojis.length === 0) {
            emojiContainer.innerHTML = `<div class="no-results">No emojis found 😢</div>`;
            return;
        }
    
        filteredEmojis.forEach(emoji => {
            const btn = document.createElement('div');
            btn.className = 'emoji-item';
            btn.textContent = emoji.char;
            btn.title = emoji.name;
            
            btn.onclick = (e) => {
                e.stopPropagation();
                focusEditorEnd();
                insertEmoji(emoji.char);
            };
            
            emojiContainer.appendChild(btn);
        });
    }
    function insertEmoji(emojiChar) {
        const selection = iframeDoc.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const textNode = iframeDoc.createTextNode(emojiChar);
        range.insertNode(textNode);
        
        range.setStartAfter(textNode);
        range.collapse(true);
        
        selection.removeAllRanges();
        selection.addRange(range);
        iframeDoc.body.focus();
    }

    // Initialize emoji picker
    renderEmojis();

    // Formatting Toolbar Functions
    const toolbar = document.getElementById('format-toolbar');
    const colorBtn = document.getElementById('color-btn');
    const colorDropdown = document.getElementById('color-dropdown');
    const linkBtn = document.getElementById('link-btn');
    const urlDropdown = document.getElementById('url-dropdown');
    const urlInput = document.getElementById('url-input');
    const insertUrlBtn = document.getElementById('insert-url');

    // Button click handlers
    toolbar.addEventListener('click', function(e) {
        const button = e.target.closest('.format-btn');
        if (!button) return;
        
        const format = button.getAttribute('data-format');
        if (!format) return;
        
        e.preventDefault();
        iframeDoc.body.focus();
        
        switch (format) {
            case 'bold':
                iframeDoc.execCommand('bold', false, null);
                break;
            case 'italic':
                iframeDoc.execCommand('italic', false, null);
                break;
            case 'underline':
                iframeDoc.execCommand('underline', false, null);
                break;
            case 'strikethrough':
                iframeDoc.execCommand('strikeThrough', false, null);
                break;
            case 'code':
                iframeDoc.execCommand('formatBlock', false, '<pre>');
                const selection = iframeDoc.getSelection();
                const range = selection.getRangeAt(0);
                const codeEl = document.createElement('code');
                range.surroundContents(codeEl);
                break;
            case 'bullet':
                iframeDoc.execCommand('insertUnorderedList', false, null);
                break;
            case 'numbered':
                iframeDoc.execCommand('insertOrderedList', false, null);
                break;
            case 'quote':
                iframeDoc.execCommand('formatBlock', false, '<blockquote>');
                break;
            case 'heading':
                iframeDoc.execCommand('formatBlock', false, '<h3>');
                break;
            case 'clear':
                iframeDoc.body.innerHTML = '';
                break;
        }
        
        updateActiveButtons();
    });

    // URL dropdown and insertion
    linkBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        
        const rect = linkBtn.getBoundingClientRect();
        urlDropdown.style.top = `${-254}px`;
        urlDropdown.style.left = `${200}px`;
        
        urlDropdown.style.display = urlDropdown.style.display === 'block' ? 'none' : 'block';
        colorDropdown.style.display = 'none';
        
        if (urlDropdown.style.display === 'block') {
            urlInput.focus();
            urlInput.value = '';
        }
    });

    insertUrlBtn.addEventListener('click', function() {
        const url = urlInput.value.trim();
        if (url) {
            iframeDoc.body.focus();
            iframeDoc.execCommand('createLink', false, url);
            urlDropdown.style.display = 'none';
        }
    });

    urlInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            insertUrlBtn.click();
        }
    });

    // Color dropdown
    colorBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        
        const rect = colorBtn.getBoundingClientRect();
        colorDropdown.style.top = `${10}px`;
        colorDropdown.style.left = `${200}px`;
        
        colorDropdown.style.display = colorDropdown.style.display === 'block' ? 'none' : 'block';
        urlDropdown.style.display = 'none';
    });

    // Color selection
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', function() {
            const color = this.getAttribute('data-color');
            iframeDoc.body.focus();
            iframeDoc.execCommand('foreColor', false, color);
            colorDropdown.style.display = 'none';
        });
    });

    // Close dropdowns when clicking elsewhere
    document.addEventListener('click', function(e) {
        if (!colorBtn.contains(e.target) && !colorDropdown.contains(e.target)) {
            colorDropdown.style.display = 'none';
        }
        
        if (!linkBtn.contains(e.target) && !urlDropdown.contains(e.target)) {
            urlDropdown.style.display = 'none';
        }
    });

    // Keyboard shortcuts
    iframe.contentWindow.document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    iframeDoc.execCommand('bold', false, null);
                    updateActiveButtons();
                    break;
                case 'i':
                    e.preventDefault();
                    iframeDoc.execCommand('italic', false, null);
                    updateActiveButtons();
                    break;
                case 'u':
                    e.preventDefault();
                    iframeDoc.execCommand('underline', false, null);
                    updateActiveButtons();
                    break;
            }
        }
    });

    // Update active buttons based on current selection state
    function updateActiveButtons() {
        const commands = [
            { selector: '[data-format="bold"]', command: 'bold' },
            { selector: '[data-format="italic"]', command: 'italic' },
            { selector: '[data-format="underline"]', command: 'underline' },
            { selector: '[data-format="strikethrough"]', command: 'strikeThrough' }
        ];
        
        commands.forEach(item => {
            const button = document.querySelector(item.selector);
            if (iframeDoc.queryCommandState(item.command)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    // Listen for selection changes to update button states
    iframeDoc.addEventListener('selectionchange', updateActiveButtons);

    // Sync iframe content to hidden input for form submission
    function syncContent() {
        hiddenInput.value = iframeDoc.body.innerHTML;
    }

    iframeDoc.addEventListener('input', syncContent);
    iframeDoc.addEventListener('blur', syncContent);

    // Adjust iframe height based on content
    function adjustIframeHeight() {
        iframe.style.height = 'auto';
        iframe.style.height = (iframeDoc.body.scrollHeight) + 'px';
    }

    // Observe content changes to adjust height
});