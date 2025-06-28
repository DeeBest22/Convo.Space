document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const floatingBtn = document.getElementById('floating-share-btn');
    const modal = document.getElementById('file-sharing-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const fileInput = document.getElementById('file-input');
    const fileSelected = document.getElementById('file-selected');
    const uploadForm = document.getElementById('upload-form');
    const filesList = document.getElementById('files-list');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const groupList = document.getElementById('group-list');
    const createGroupBtn = document.getElementById('create-group-btn');
    const createGroupModal = document.getElementById('create-group-modal');
    const closeGroupModalBtn = document.getElementById('close-group-modal-btn');
    const createGroupForm = document.getElementById('create-group-form');
    const currentGroupName = document.getElementById('current-group-name');
    const loadingSpinner = document.getElementById('loading-spinner');

    // State
    let currentGroupId = null;
    let files = [];
    let groups = [];
    
    // API endpoints
    const API_URL = '/api';
    const ENDPOINTS = {
        FILES: `${API_URL}/files`,
        GROUPS: `${API_URL}/groups`,
    };

    // Initialize the app
    initApp();

    // Event listeners
    floatingBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', outsideClick);
    fileInput.addEventListener('change', handleFileSelection);
    uploadForm.addEventListener('submit', uploadFiles);
    searchBtn.addEventListener('click', searchFiles);
    searchInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') searchFiles();
    });
    createGroupBtn.addEventListener('click', openCreateGroupModal);
    closeGroupModalBtn.addEventListener('click', closeCreateGroupModal);
    createGroupForm.addEventListener('submit', createGroup);

    // Close modal if clicked outside
    function outsideClick(e) {
        if (e.target === modal) closeModal();
        if (e.target === createGroupModal) closeCreateGroupModal();
    }

    // Open/close main modal
    function openModal() {
        modal.style.display = 'flex';
        refreshFilesList();
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    // Open/close group creation modal
    function openCreateGroupModal() {
        createGroupModal.style.display = 'flex';
    }

    function closeCreateGroupModal() {
        createGroupModal.style.display = 'none';
    }

    // File selection handler
    function handleFileSelection() {
        if (fileInput.files.length > 0) {
            fileSelected.textContent = `${fileInput.files.length} file(s) selected`;
        } else {
            fileSelected.textContent = 'No files selected';
        }
    }

    // Initialize the application
    async function initApp() {
        await loadGroups();
        refreshFilesList();
    }

    // Load user groups
    async function loadGroups() {
        try {
            const response = await fetch(ENDPOINTS.GROUPS);
            if (!response.ok) throw new Error('Failed to load groups');
            
            groups = await response.json();
            renderGroups();
        } catch (error) {
            showNotification('Error loading groups', 'error');
            console.error('Error loading groups:', error);
        }
    }

    // Render groups in the sidebar
    function renderGroups() {
        groupList.innerHTML = `
            <div class="group-item ${!currentGroupId ? 'active' : ''}" data-id="null">
                <i class="fas fa-folder"></i>
                <span>All Files</span>
            </div>
        `;

        groups.forEach(group => {
            const groupItem = document.createElement('div');
            groupItem.className = `group-item ${currentGroupId === group.id ? 'active' : ''}`;
            groupItem.dataset.id = group.id;
            groupItem.innerHTML = `
                <i class="fas fa-folder"></i>
                <span>${group.name}</span>
            `;
            groupList.appendChild(groupItem);
        });

        // Add event listeners to group items
        document.querySelectorAll('.group-item').forEach(item => {
            item.addEventListener('click', () => {
                currentGroupId = item.dataset.id === 'null' ? null : item.dataset.id;
                document.querySelectorAll('.group-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                currentGroupName.textContent = item.dataset.id === 'null' ? 'All Files' : 
                    groups.find(g => g.id === currentGroupId)?.name || 'All Files';
                refreshFilesList();
            });
        });
    }

    // Create a new group
    async function createGroup(e) {
        e.preventDefault();
        
        const groupName = document.getElementById('group-name').value;
        const description = document.getElementById('group-description').value;

        if (!groupName.trim()) {
            showNotification('Group name is required', 'error');
            return;
        }

        try {
            const response = await fetch(ENDPOINTS.GROUPS, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: groupName,
                    description: description
                })
            });

            if (!response.ok) throw new Error('Failed to create group');
            
            const newGroup = await response.json();
            groups.push(newGroup);
            renderGroups();
            closeCreateGroupModal();
            
            // Select the newly created group
            currentGroupId = newGroup.id;
            currentGroupName.textContent = newGroup.name;
            refreshFilesList();
            
            // Reset form
            createGroupForm.reset();
            showNotification('Group created successfully', 'success');
        } catch (error) {
            showNotification('Error creating group', 'error');
            console.error('Error creating group:', error);
        }
    }

    // Upload files
    // Upload files with progress tracking
async function uploadFiles(e) {
    e.preventDefault();
    
    if (fileInput.files.length === 0) {
        showNotification('Please select files to upload', 'error');
        return;
    }

    const formData = new FormData();
    for (const file of fileInput.files) {
        formData.append('files', file);
    }
    
    if (currentGroupId) {
        formData.append('groupId', currentGroupId);
    }

    // Create upload progress notification
    const progressNotification = document.createElement('div');
    progressNotification.className = 'notification info';
    progressNotification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-cloud-upload-alt"></i>
            <span>Uploading files: 0%</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width:0%"></div>
        </div>
    `;
    document.body.appendChild(progressNotification);
    
    try {
        const xhr = new XMLHttpRequest();
        
        xhr.open('POST', ENDPOINTS.FILES, true);
        
        // Track upload progress
        xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progressNotification.querySelector('span').textContent = `Uploading files: ${percentComplete}%`;
                progressNotification.querySelector('.progress-fill').style.width = `${percentComplete}%`;
            }
        };
        
        // Handle completion
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                document.body.removeChild(progressNotification);
                showNotification('Files uploaded successfully!', 'success');
                fileInput.value = '';
                fileSelected.textContent = 'No files selected';
                refreshFilesList();
            } else {
                document.body.removeChild(progressNotification);
                let errorMsg = 'Failed to upload files';
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.error) errorMsg = response.error;
                    if (response.details) errorMsg += `: ${response.details}`;
                } catch (e) {}
                showNotification(errorMsg, 'error');
            }
        };
        
        // Handle upload error
        xhr.onerror = function() {
            document.body.removeChild(progressNotification);
            showNotification('Network error during upload', 'error');
        };
        
        xhr.send(formData);
    } catch (error) {
        document.body.removeChild(progressNotification);
        showNotification(`Error uploading files: ${error.message}`, 'error');
        console.error('Error uploading files:', error);
    }
}
    // Refresh files list
    async function refreshFilesList() {
        loadingSpinner.style.display = 'block';
        filesList.innerHTML = '';
        
        try {
            let url = ENDPOINTS.FILES;
            if (currentGroupId) {
                url += `?groupId=${currentGroupId}`;
            }
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch files');
            
            files = await response.json();
            renderFiles(files);
        } catch (error) {
            showNotification('Error loading files', 'error');
            console.error('Error loading files:', error);
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    // Render files list
    function renderFiles(filesToRender) {
        if (filesToRender.length === 0) {
            filesList.innerHTML = '<div class="no-files">No files found</div>';
            return;
        }

        filesList.innerHTML = '';
        filesToRender.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.id = file.id;
            
            // Determine file icon based on file type
            let fileIcon = 'fa-file';
            if (file.mimeType) {
                if (file.mimeType.startsWith('image/')) fileIcon = 'fa-file-image';
                else if (file.mimeType.startsWith('video/')) fileIcon = 'fa-file-video';
                else if (file.mimeType.startsWith('audio/')) fileIcon = 'fa-file-audio';
                else if (file.mimeType.includes('pdf')) fileIcon = 'fa-file-pdf';
                else if (file.mimeType.includes('word')) fileIcon = 'fa-file-word';
                else if (file.mimeType.includes('excel') || file.mimeType.includes('spreadsheet')) fileIcon = 'fa-file-excel';
                else if (file.mimeType.includes('zip') || file.mimeType.includes('archive')) fileIcon = 'fa-file-archive';
            }

            fileItem.innerHTML = `
                <div class="file-icon">
                    <i class="fas ${fileIcon}"></i>
                </div>
                <div class="file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="file-meta">
                        <span class="file-size">${formatFileSize(file.size)}</span>
                        <span class="file-date">${formatDate(new Date(file.uploadedAt))}</span>
                        ${file.groupName ? `<span class="file-group">${file.groupName}</span>` : ''}
                    </div>
                </div>
                <div class="file-actions">
                    <button class="action-btn download-btn" title="Download" data-id="${file.id}">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn delete-btn" title="Delete" data-id="${file.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            filesList.appendChild(fileItem);
        });

        // Add event listeners to file action buttons
        document.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', () => downloadFile(btn.dataset.id));
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteFile(btn.dataset.id));
        });
    }

    // Search files
    function searchFiles() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        if (searchTerm === '') {
            renderFiles(files);
            return;
        }
        
        const filteredFiles = files.filter(file => 
            file.name.toLowerCase().includes(searchTerm)
        );
        
        renderFiles(filteredFiles);
    }

    // Download file
    async function downloadFile(fileId) {
        try {
            window.location.href = `${ENDPOINTS.FILES}/${fileId}/download`;
        } catch (error) {
            showNotification('Error downloading file', 'error');
            console.error('Error downloading file:', error);
        }
    }

    // Delete file
    async function deleteFile(fileId) {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            const response = await fetch(`${ENDPOINTS.FILES}/${fileId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete file');
            
            showNotification('File deleted successfully', 'success');
            refreshFilesList();
        } catch (error) {
            showNotification('Error deleting file', 'error');
            console.error('Error deleting file:', error);
        }
    }

    // Helper: Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Helper: Format date
    function formatDate(date) {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Helper: Show notification
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 3000);
    }
});