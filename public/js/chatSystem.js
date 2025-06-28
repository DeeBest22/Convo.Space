// Global variables
let users = {};
const chatSocket = io();
let myName = '';

let selectedChat = 'general';
let currentPrivateRecipient = null; // For private chats
let chatHistory = { general: [] };
let groupsData = {};
let pendingJoinRequest = null;
let typingUsers = {}; // { conversationId: Set of names }
let editingMessageId = null;
let editingChatId = null;
// Define currentConfig only once.
let currentConfig = { chatEnabled: true, generalOnly: false, allowGroupCreation: true };

// Voice recording variables
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

// Fetch user data from the server
fetch('/api/user')
    .then(response => response.json())
    .then(data => {
        if (data.user) {
            myName = data.user.name; // Store the name globally
            const userInfoElement = document.getElementById('userInfoChat');
            if (userInfoElement) {
                userInfoElement.innerHTML = `Welcome, ${myName}! | <a href="/logout">Logout</a>`;
            }
            // Register with socket after getting the name
            if (chatSocket.connected) {
                chatSocket.emit('register', myName);
            }
        } else {
            const userInfoElement = document.getElementById('userInfoChat');
            if (userInfoElement) {
                userInfoElement.innerHTML = "You are not logged in.";
            }
        }
    })
    .catch(error => {
        console.error('Error fetching user data:', error);
        const userInfoElement = document.getElementById('userInfoChat');
        if (userInfoElement) {
            userInfoElement.innerHTML = "Error fetching user data.";
        }
    });

// Helper: Generate a consistent key for private conversation (order-independent)
function getPrivateChatKey(a, b) {
    return a < b ? a + "-" + b : b + "-" + a;
}

// Helper: Given a conversation key for a private chat, return the recipient's chatSocket id (the one that's not mine)
function getRecipientFromConversationKey(chatKey) {
    const parts = chatKey.split("-");
    return parts[0] === chatSocket.id ? parts[1] : parts[0];
}

// Notification: show a small toast popup (format "UserXXX : message") for private messages
function showNotification(message) {
    const container = document.getElementById("notificationContainer");
    const notification = document.createElement("div");
    notification.textContent = message;
    notification.className = "notification";
    container.appendChild(notification);

    setTimeout(() => {
        if (container.contains(notification)) {
            container.removeChild(notification);
        }
    }, 3000);
}

// Create notification container if not exists.
(function() {
    if (!document.getElementById("notificationContainer")) {
        const container = document.createElement("div");
        container.id = "notificationContainer";
        container.style.position = "fixed";
        container.style.bottom = "20px";
        container.style.right = "20px";
        container.style.zIndex = "2000";
        document.body.appendChild(container);
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    // Wait for myName to be fetched before registering
    const waitForName = () => {
        if (myName) {
            chatSocket.emit('register', myName);
        } else {
            setTimeout(waitForName, 100);
        }
    };
    waitForName();

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        chatInput.addEventListener('input', () => {
            sendTyping();
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => { stopTyping(); }, 2000);
        });
    }

    // Setup voice recording button
    const recordButton = document.getElementById('recordButton');
    if (recordButton) {
        recordButton.addEventListener('click', toggleRecording);
    }
});

let typingTimeout;

// Voice recording functions
function toggleRecording() {
    if (!currentConfig.chatEnabled) return;
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
}

function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Your browser does not support audio recording.");
        return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            recordedChunks = [];
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) recordedChunks.push(e.data);
            };
            mediaRecorder.onstop = uploadVoiceMessage;
            mediaRecorder.start();
            isRecording = true;
            const recordButton = document.getElementById('recordButton');
            if (recordButton) {
                recordButton.textContent = "⏹️";
            }
        })
        .catch(err => {
            console.error("Error accessing microphone:", err);
            alert("Could not start recording.");
        });
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        const recordButton = document.getElementById('recordButton');
        if (recordButton) {
            recordButton.textContent = "🎤";
        }
    }
}

function uploadVoiceMessage() {
    const blob = new Blob(recordedChunks, { type: 'audio/ogg' });
    const id = Date.now() + '-' + Math.floor(Math.random() * 1000);
    const formData = new FormData();
    formData.append('file', blob, 'voice_message.ogg');
    const statusDiv = document.getElementById('uploadStatus');
    if (statusDiv) {
        statusDiv.textContent = 'Uploading voice message...';
    }
    
    fetch('/upload', { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.fileUrl) {
                if (statusDiv) {
                    statusDiv.textContent = 'Voice message uploaded.';
                }
                const payload = { id, fileUrl: data.fileUrl, fileType: 'audio' };
                if (selectedChat === 'general') {
                    payload.to = 'general';
                    chatSocket.emit('sendMedia', payload);
                } else if (selectedChat.startsWith("group-")) {
                    chatSocket.emit('sendGroupMessage', { id, groupId: selectedChat, message: data.fileUrl, type: 'audio' });
                } else {
                    payload.to = currentPrivateRecipient;
                    chatSocket.emit('sendMedia', payload);
                    const localVoiceMessage = { id, from: myName, fromchatSocketId: currentPrivateRecipient, message: data.fileUrl, type: 'audio' };
                    if (!chatHistory[selectedChat]) chatHistory[selectedChat] = [];
                    chatHistory[selectedChat].push(localVoiceMessage);
                    displayMessage(localVoiceMessage);
                }
            } else {
                if (statusDiv) {
                    statusDiv.textContent = 'Error: ' + (data.error || 'Unknown error');
                }
            }
        })
        .catch(err => { 
            if (statusDiv) {
                statusDiv.textContent = 'Upload failed: ' + err;
            }
        });
}

chatSocket.on('updateUsers', (serverUsers) => {
    users = serverUsers;
    const participantsChatsList = document.getElementById('participantsChats');
    if (participantsChatsList) {
        participantsChatsList.innerHTML = '<li function="liName" onclick="selectChat(\'general\')">General</li>';
        for (const [chatSocketId, name] of Object.entries(users)) {
            if (chatSocketId !== chatSocket.id) {
                const li = document.createElement('li');
                li.textContent = name;
                li.setAttribute("function", "liName");
                li.setAttribute("namer", "participantsChat-name");
                li.onclick = () => {
                    // Block switching if generalOnly is enabled
                    if (currentConfig.generalOnly) return;
                    const key = getPrivateChatKey(chatSocket.id, chatSocketId);
                    currentPrivateRecipient = chatSocketId;
                    selectChat(key);
                };
                participantsChatsList.appendChild(li);
                if (!chatHistory[getPrivateChatKey(chatSocket.id, chatSocketId)]) {
                    chatHistory[getPrivateChatKey(chatSocket.id, chatSocketId)] = [];
                }
            }
        }
    }
});

// ===== GROUP EVENTS =====
chatSocket.on('groupCreated', (group) => {
    groupsData[group.id] = group;
    addGroupToList(group);
});

chatSocket.on('groupUpdated', (group) => {
    groupsData[group.id] = group;
    updateGroupInList(group);
});

chatSocket.on('groupDeleted', (data) => {
    removeGroupFromList(data.groupId);
    delete groupsData[data.groupId];
});

chatSocket.on('joinedGroup', (group) => {
    groupsData[group.id] = group;
    addGroupToList(group);
    console.log("Joined group:", group.name);
});

chatSocket.on('joinGroupRequest', (data) => { 
    showJoinRequestModal(data); 
});

// ===== MESSAGES =====
chatSocket.on('receiveGeneralMessage', (data) => {
    if (!chatHistory['general']) chatHistory['general'] = [];
    chatHistory['general'].push(data);
    if (selectedChat === 'general') displayMessage(data);
});

chatSocket.on('receivePrivateMessage', (data) => {
    let key;
    if (data.fromchatSocketId === chatSocket.id) {
        key = getPrivateChatKey(chatSocket.id, data.to);
    } else {
        key = getPrivateChatKey(data.fromchatSocketId, chatSocket.id);
        if (selectedChat !== key) {
            showNotification(data.from + " : " + data.message);
        }
    }
    if (!chatHistory[key]) chatHistory[key] = [];
    chatHistory[key].push(data);
    if (selectedChat === key) displayMessage(data);
});

chatSocket.on('receiveGroupMessage', (data) => {
    if (!chatHistory[data.groupId]) chatHistory[data.groupId] = [];
    chatHistory[data.groupId].push(data);
    if (selectedChat === data.groupId) displayMessage(data);
});

chatSocket.on('messageDeleted', (data) => {
    if (chatHistory[data.chat]) {
        chatHistory[data.chat] = chatHistory[data.chat].filter(msg => msg.id !== data.id);
        if (selectedChat === data.chat) renderChatHistory(data.chat);
    }
});

chatSocket.on('messageEdited', (data) => {
    if (chatHistory[data.chat]) {
        chatHistory[data.chat] = chatHistory[data.chat].map(msg => {
            if (msg.id === data.id) {
                return { ...msg, message: data.newMessage, edited: true };
            }
            return msg;
        });
        if (selectedChat === data.chat) renderChatHistory(data.chat);
    }
});

// ===== TYPING INDICATOR =====
chatSocket.on('displayTyping', (data) => {
    if (data.chatSocketId === chatSocket.id) return;
    if (data.conversation === selectedChat) {
        if (!typingUsers[selectedChat]) typingUsers[selectedChat] = new Set();
        typingUsers[selectedChat].add(data.from);
        updateTypingIndicator();
    }
});

chatSocket.on('removeTyping', (data) => {
    if (data.conversation === selectedChat && typingUsers[selectedChat]) {
        typingUsers[selectedChat].delete(data.from);
        updateTypingIndicator();
    }
});

function updateTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (!indicator) return;
    
    const usersTyping = typingUsers[selectedChat] ? Array.from(typingUsers[selectedChat]) : [];
    if (usersTyping.length > 0) {
        indicator.innerHTML = usersTyping.join(', ') + " is typing <span class='typing-dots'><span></span><span></span><span></span></span>";
    } else {
        indicator.innerHTML = "";
    }
}

function sendTyping() {
    if (selectedChat === 'general' || selectedChat.startsWith("group-")) {
        chatSocket.emit('typing', { to: selectedChat, conversation: selectedChat });
    } else {
        chatSocket.emit('typing', { to: currentPrivateRecipient, conversation: selectedChat });
    }
}

function stopTyping() {
    if (selectedChat === 'general' || selectedChat.startsWith("group-")) {
        chatSocket.emit('stopTyping', { to: selectedChat, conversation: selectedChat });
    } else {
        chatSocket.emit('stopTyping', { to: currentPrivateRecipient, conversation: selectedChat });
    }
}

// ===== CONFIGURATION HANDLING =====
chatSocket.on('configChanged', (config) => {
    currentConfig = config;
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('sendButton');
    const fileUpload = document.getElementById('file-upload');
    const recordButton = document.getElementById('recordButton');
    const groupCreateBtn = document.getElementById('groupCreateBtn');

    if (!config.chatEnabled) {
        if (chatInput) {
            chatInput.disabled = true;
            chatInput.placeholder = "Chat is disabled by admin.";
        }
        if (sendButton) sendButton.disabled = true;
        if (fileUpload) fileUpload.disabled = true;
        if (recordButton) recordButton.disabled = true;
    } else if (config.generalOnly) {
        // Force selectedChat to 'general'
        if (selectedChat !== 'general') {
            selectedChat = 'general';
            renderChatHistory('general');
            updateChatTitle('general');
        }

        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = "Type a message...";
        }
        if (sendButton) sendButton.disabled = false;
        if (fileUpload) fileUpload.disabled = false;
        if (recordButton) recordButton.disabled = false;
    } else {
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = "Type a message...";
        }
        if (sendButton) sendButton.disabled = false;
        if (fileUpload) fileUpload.disabled = false;
        if (recordButton) recordButton.disabled = false;
    }
    
    // Disable group creation if not allowed.
    if (groupCreateBtn) {
        if (!config.allowGroupCreation) {
            groupCreateBtn.style.display = "none";
        } else {
            groupCreateBtn.style.display = "inline-block";
        }
    }
    
    renderChatHistory(selectedChat);
});

// ===== GROUPS LIST MANAGEMENT =====
function addGroupToList(group) {
    const groupsList = document.getElementById('groupsList');
    if (!groupsList) return;
    
    let li = document.getElementById("group-" + group.id);

    if (!li) {
        li = document.createElement('li');
        li.id = "group-" + group.id;
        li.textContent = group.name;

        if (!group.members.includes(chatSocket.id)) {
            const joinBtn = document.createElement('button');
            joinBtn.textContent = "Join";
            joinBtn.onclick = () => { 
                if (currentConfig.generalOnly) return;
                chatSocket.emit('requestJoinGroup', { groupId: group.id }); 
            };
            li.appendChild(joinBtn);
        } else {
            li.onclick = () => {
                if (currentConfig.generalOnly) return;
                selectChat(group.id);
            };
        }
        groupsList.appendChild(li);
    }
}

function updateGroupInList(group) {
    let li = document.getElementById("group-" + group.id);
    if (li) {
        li.textContent = group.name;
        if (group.members.includes(chatSocket.id)) {
            li.onclick = () => {
                if (currentConfig.generalOnly) return;
                selectChat(group.id);
            };
        }
    } else {
        addGroupToList(group);
    }
}

function removeGroupFromList(groupId) {
    const li = document.getElementById("group-" + groupId);
    if (li) li.remove();
}

function openCreateGroupModal() {
    if (!currentConfig.allowGroupCreation) return;
    const groupNameInput = document.getElementById("groupNameInput");
    const groupOpenCheckbox = document.getElementById("groupOpenCheckbox");
    const createGroupModal = document.getElementById("createGroupModal");
    
    if (groupNameInput) groupNameInput.value = "";
    if (groupOpenCheckbox) groupOpenCheckbox.checked = false;
    if (createGroupModal) createGroupModal.style.display = "block";
}

function closeCreateGroupModal() {
    const createGroupModal = document.getElementById("createGroupModal");
    if (createGroupModal) createGroupModal.style.display = "none";
}

function submitCreateGroup() {
    const groupNameInput = document.getElementById("groupNameInput");
    const groupOpenCheckbox = document.getElementById("groupOpenCheckbox");
    
    if (!groupNameInput) return;
    const groupName = groupNameInput.value.trim();
    if (!groupName) return;
    
    const openGroup = groupOpenCheckbox ? groupOpenCheckbox.checked : false;
    chatSocket.emit('createGroup', { groupName, open: openGroup });
    closeCreateGroupModal();
}

function showJoinRequestModal(data) {
    pendingJoinRequest = data;
    const joinRequestText = document.getElementById("joinRequestText");
    const joinRequestModal = document.getElementById("joinRequestModal");
    
    if (joinRequestText) {
        joinRequestText.textContent = data.requesterName + " wants to join your group.";
    }
    if (joinRequestModal) {
        joinRequestModal.style.display = "block";
    }
}

function closeJoinRequestModal() {
    const joinRequestModal = document.getElementById("joinRequestModal");
    if (joinRequestModal) joinRequestModal.style.display = "none";
    pendingJoinRequest = null;
}

function acceptJoinRequest() {
    if (pendingJoinRequest) {
        chatSocket.emit('acceptJoinGroup', { 
            groupId: pendingJoinRequest.groupId, 
            requesterId: pendingJoinRequest.requesterId 
        });
        closeJoinRequestModal();
    }
}

function declineJoinRequest() { 
    closeJoinRequestModal(); 
}

// ===== CHAT MESSAGES MANAGEMENT =====
function renderChatHistory(chatId) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    chatMessages.innerHTML = '';
    if (chatHistory[chatId]) {
        chatHistory[chatId].forEach(msg => displayMessage(msg));
    }
}

function displayMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.setAttribute("class", "displayedMessage");
    let content = "";
    
    if (message.type === 'text') {
        content = `${message.from} <br> ${message.message}` + (message.edited ? " <span class='edited-marker'>(edited)</span>" : "");
    } else if (message.type === 'audio') {
        content = `<strong>${message.from} :</strong><br>
                   <audio controls src="${message.message}" style="max-width:100%;">Your browser does not support audio.</audio><br>
                   <a href="${message.message}" download>Download Voice Message</a>`;
    } else {
        if (message.type === 'image') {
            content = `<strong>${message.from} :</strong><br>
                       <img src="${message.message}" alt="Image" style="max-width:100%;"><br>
                       <a href="${message.message}" download>Download Image</a>`;
        } else if (message.type === 'gif') {
            content = `<strong>${message.from} :</strong><br>
                       <img src="${message.message}" alt="GIF" style="max-width:100%;"><br>
                       <a href="${message.message}" download>Download GIF</a>`;
        } else if (message.type === 'video') {
            content = `<strong>${message.from} :</strong><br>
                       <video src="${message.message}" controls style="max-width:100%;"></video><br>
                       <a href="${message.message}" download>Download Video</a>`;
        } else if (message.type === 'document') {
            content = `<strong>${message.from} :</strong><br>
                       <a href="${message.message}" download>${message.filename || "Download Document"}</a>`;
        }
    }
    
    msgDiv.innerHTML = `<span class="displayedSpan">${content}</span>`;
    
    if (currentConfig.chatEnabled) {
        if (message.from === myName && message.type === 'text') {
            const editBtn = document.createElement('span');
            editBtn.innerHTML = ' <i class="fas fa-pencil-alt"></i> ';
            editBtn.classList.add('edit-btn');
            editBtn.onclick = () => { openEditMessageModal(message.id, message.message); };
            msgDiv.appendChild(editBtn);
        }
        if (message.from === myName) {
            const delBtn = document.createElement('span');
            delBtn.innerHTML = ' <i class="fas fa-trash-alt"></i>';
            delBtn.classList.add('delete-btn');
            delBtn.onclick = () => { deleteMessage(message.id); };
            msgDiv.appendChild(delBtn);
        }
    }
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function toggleChat() {
    const chatBar = document.querySelector('.chat-bar');
    if (chatBar) {
        chatBar.classList.toggle('open');
    }
}

function selectChat(chatId) {
    // If generalOnly is enabled, force chatId to 'general'
    if (currentConfig.generalOnly && chatId !== 'general') {
        selectedChat = 'general';
    } else {
        selectedChat = chatId;
    }
    renderChatHistory(selectedChat);
    updateChatTitle(selectedChat);
    if (typingUsers[selectedChat]) { 
        typingUsers[selectedChat].clear(); 
    }
    updateTypingIndicator();
}

function updateChatTitle(chatId) {
    const chatTitle = document.getElementById("chat-title");
    if (!chatTitle) return;
    
    if (chatId === 'general') {
        chatTitle.textContent = 'General';
    } else if (chatId.startsWith("group-")) {
        const group = groupsData[chatId];
        chatTitle.textContent = group ? group.name : 'Group Chat';
    } else {
        // Private chat - find the other user's name
        const recipientId = getRecipientFromConversationKey(chatId);
        const recipientName = users[recipientId] || 'Private Chat';
        chatTitle.textContent = recipientName;
    }
}

function sendMessage() {
    const iframe = document.getElementById('chat-input');
    if (!iframe) return;
    
    const input = iframe.contentDocument || iframe.contentWindow.document;
    const editorContent = input.getElementById('editor-content');

    let messageText = "";

    if (editorContent) {
        messageText = editorContent.innerHTML.trim();
    } else {
        console.error("Element not found inside iframe!");
        return;
    }

    if (!messageText) return;
    
    const id = Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    if (selectedChat === 'general') {
        chatSocket.emit('sendMessage', { id, to: 'general', message: messageText });
    } else if (selectedChat.startsWith("group-")) {
        chatSocket.emit('sendGroupMessage', { id, groupId: selectedChat, message: messageText });
    } else {
        const localMessage = { 
            id, 
            from: myName, 
            fromchatSocketId: currentPrivateRecipient, 
            message: messageText, 
            type: 'text' 
        };
        if (!chatHistory[selectedChat]) chatHistory[selectedChat] = [];
        chatHistory[selectedChat].push(localMessage);
        displayMessage(localMessage);
        chatSocket.emit('sendMessage', { id, to: currentPrivateRecipient, message: messageText });
    }

    // Clear the input in the iframe
    if (editorContent) {
        editorContent.innerHTML = "";
    }

    stopTyping();
}

// Optional helper function for clearing the message input
function clearMessageInput() {
    const iframe = document.getElementById('chat-input');
    if (!iframe) return false;
    
    const input = iframe.contentDocument || iframe.contentWindow.document;
    const editorContent = input.getElementById('editor-content');

    if (editorContent) {
        editorContent.innerHTML = "";
        return true;
    }
    return false;
}

function deleteMessage(id) {
    chatSocket.emit('deleteMessage', { id, to: selectedChat });
    if (chatHistory[selectedChat]) {
        chatHistory[selectedChat] = chatHistory[selectedChat].filter(msg => msg.id !== id);
        renderChatHistory(selectedChat);
    }
}

// ===== EDIT MESSAGE MODAL =====
function openEditMessageModal(messageId, currentText) {
    editingMessageId = messageId;
    editingChatId = selectedChat;
    const editMessageInput = document.getElementById('editMessageInput');
    const editMessageModal = document.getElementById('editMessageModal');
    
    if (editMessageInput) editMessageInput.value = currentText;
    if (editMessageModal) editMessageModal.style.display = "block";
}

function closeEditMessageModal() {
    editingMessageId = null;
    editingChatId = null;
    const editMessageModal = document.getElementById('editMessageModal');
    if (editMessageModal) editMessageModal.style.display = "none";
}

function submitEditMessage() {
    const editMessageInput = document.getElementById('editMessageInput');
    if (!editMessageInput) return;
    
    const newText = editMessageInput.value.trim();
    if (newText === "" || newText === null) { 
        closeEditMessageModal(); 
        return; 
    }
    
    if (chatHistory[editingChatId]) {
        chatHistory[editingChatId] = chatHistory[editingChatId].map(msg => {
            if (msg.id === editingMessageId) {
                return { ...msg, message: newText, edited: true };
            }
            return msg;
        });
        renderChatHistory(editingChatId);
    }
    
    chatSocket.emit('editMessage', { 
        id: editingMessageId, 
        to: editingChatId, 
        newMessage: newText 
    });
    closeEditMessageModal();
}

// ===== FILE UPLOAD HANDLING =====
const fileUploadElement = document.getElementById('file-upload');
if (fileUploadElement) {
    fileUploadElement.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const id = Date.now() + '-' + Math.floor(Math.random() * 1000);
        const formData = new FormData();
        formData.append('file', file);
        const statusDiv = document.getElementById('uploadStatus');
        
        if (statusDiv) {
            statusDiv.textContent = 'Uploading...';
        }
        
        fetch('/upload', { method: 'POST', body: formData })
            .then(response => response.json())
            .then(data => {
                if (data.fileUrl) {
                    if (statusDiv) {
                        statusDiv.textContent = 'File uploaded successfully.';
                    }
                    
                    let type = "";
                    if (file.type.startsWith("image")) {
                        type = (file.type === "image/gif") ? "gif" : "image";
                    } else if (file.type.startsWith("video")) {
                        type = "video";
                    } else if (file.type.startsWith("audio")) {
                        type = "audio";
                    } else {
                        type = "document";
                    }
                    
                    const payload = { id, fileUrl: data.fileUrl, fileType: type };
                    if (type === "document") { 
                        payload.filename = data.filename; 
                    }
                    
                    if (selectedChat === 'general') {
                        payload.to = 'general';
                        chatSocket.emit('sendMedia', payload);
                    } else if (selectedChat.startsWith("group-")) {
                        chatSocket.emit('sendGroupMessage', { 
                            id, 
                            groupId: selectedChat, 
                            message: data.fileUrl, 
                            type: type 
                        });
                    } else {
                        payload.to = currentPrivateRecipient;
                        chatSocket.emit('sendMedia', payload);
                        const localFileMessage = { 
                            id, 
                            from: myName, 
                            fromchatSocketId: currentPrivateRecipient, 
                            message: data.fileUrl, 
                            type: type 
                        };
                        if (type === "document") { 
                            localFileMessage.filename = data.filename; 
                        }
                        if (!chatHistory[selectedChat]) chatHistory[selectedChat] = [];
                        chatHistory[selectedChat].push(localFileMessage);
                        displayMessage(localFileMessage);
                    }
                } else {
                    if (statusDiv) {
                        statusDiv.textContent = 'Error: ' + (data.error || 'Unknown error');
                    }
                }
            })
            .catch(err => { 
                if (statusDiv) {
                    statusDiv.textContent = 'Upload failed: ' + err;
                }
            });
    });
}

chatSocket.on('existingGroups', (groupsArray) => {
    const groupsList = document.getElementById('groupsList');
    if (groupsList) {
        groupsList.innerHTML = ''; // Clear any existing list
        groupsArray.forEach(group => {
            addGroupToList(group);
        });
    }
});

// Handle chat title updates when clicking on participantsChats
document.addEventListener("click", function(event) {
    const clickedLi = event.target.closest('li[function="liName"]');

    // Ensure the clicked element is an <li> and does not contain a <button>
    if (clickedLi && !clickedLi.querySelector("button")) {
        const chatTitle = document.getElementById("chat-title");
        if (chatTitle) {
            chatTitle.textContent = clickedLi.textContent;
        }
    }
});

// Run this in the browser console to test
function enforceIframeHeight() {
    const iframe = document.getElementById('chat-input');
    if (iframe) {
        iframe.style.height = '100px'; // Your desired height
        iframe.setAttribute('height', '100px');
    }
}

// Run immediately
enforceIframeHeight();

// Also run repeatedly to override any scripts that might be changing it
setInterval(enforceIframeHeight, 100);

// JavaScript to toggle the visibility of the format toolbar
const toggleButton = document.getElementById('toggleButton');
if (toggleButton) {
    toggleButton.addEventListener('click', function() {
        const toolbar = document.getElementById('format-toolbar');
        if (toolbar) {
            toolbar.classList.toggle('visible');
            
            // Change icon when toggled
            const icon = this.querySelector('i');
            if (icon) {
                if (toolbar.classList.contains('visible')) {
                    icon.classList.remove('fa-palette');
                    icon.classList.add('fa-times');
                } else {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-palette');
                }
            }
        }
    });
}