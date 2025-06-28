import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function setupFileShare(app, io) {
    // ---- FILE SHARING SETUP ----
    // Multer setup - Increase file size limit to 500MB
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueFilename = `${uuidv4()}-${file.originalname}`;
            cb(null, uniqueFilename);
        }
    });

    // Configure multer with increased file size
    const upload = multer({ 
        storage, 
        limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
        fileFilter: (req, file, cb) => {
            // Accept all file types, including video
            cb(null, true);
        }
    });

    // File and group storage
    let files = [];
    let groups = [];

    // Ensure directories exist
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Load existing data if available
    try {
        if (fs.existsSync(path.join(dataDir, 'files.json'))) {
            files = JSON.parse(fs.readFileSync(path.join(dataDir, 'files.json'), 'utf8'));
        }
        if (fs.existsSync(path.join(dataDir, 'groups.json'))) {
            groups = JSON.parse(fs.readFileSync(path.join(dataDir, 'groups.json'), 'utf8'));
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }

    // Function to save data
    function saveData() {
        try {
            fs.writeFileSync(path.join(dataDir, 'files.json'), JSON.stringify(files, null, 2));
            fs.writeFileSync(path.join(dataDir, 'groups.json'), JSON.stringify(groups, null, 2));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    // Setup broadcast for file sharing updates
    const clients = new Set();
    const fileUpdatesNamespace = io.of('/file-updates');
    
    fileUpdatesNamespace.on('connection', (socket) => {
        clients.add(socket);
        console.log('Client connected to file-updates namespace');
        
        socket.on('disconnect', () => {
            clients.delete(socket);
            console.log('Client disconnected from file-updates namespace');
        });
    });

    function broadcastUpdate(type, data) {
        fileUpdatesNamespace.emit('update', { type, data });
    }

    // ---- FILE SHARING ROUTE HANDLERS ----
    const handlePostFiles = (req, res) => {
        try {
            const uploadedFiles = req.files;
            if (!uploadedFiles || uploadedFiles.length === 0) {
                return res.status(400).json({ error: 'No files uploaded' });
            }

            const { groupId } = req.body;
            const newFiles = uploadedFiles.map(file => {
                const fileData = {
                    id: uuidv4(),
                    name: file.originalname,
                    path: file.path,
                    size: file.size,
                    mimeType: file.mimetype,
                    uploadedAt: new Date().toISOString(),
                    groupId: groupId || null
                };
                files.push(fileData);
                return fileData;
            });
            
            saveData();
            res.status(201).json(newFiles);
            broadcastUpdate('files-updated', newFiles);
        } catch (error) {
            console.error('Error uploading files:', error);
            res.status(500).json({ error: 'Failed to upload files', details: error.message });
        }
    };

    const handleDeleteFiles = (req, res) => {
        try {
            const { id } = req.params;
            const fileIndex = files.findIndex(f => f.id === id);
            
            if (fileIndex === -1) {
                return res.status(404).json({ error: 'File not found' });
            }

            const fileToDelete = files[fileIndex];
            
            // Delete physical file
            if (fs.existsSync(fileToDelete.path)) {
                fs.unlinkSync(fileToDelete.path);
            }
            
            // Remove from array
            files.splice(fileIndex, 1);
            saveData();
            
            res.status(200).json({ message: 'File deleted successfully' });
            broadcastUpdate('files-updated', { deletedFileId: id });
        } catch (error) {
            console.error('Error deleting file:', error);
            res.status(500).json({ error: 'Failed to delete file', details: error.message });
        }
    };

    const handlePostGroups = (req, res) => {
        try {
            const { name, description } = req.body;
            if (!name || name.trim() === '') {
                return res.status(400).json({ error: 'Group name is required' });
            }

            const newGroup = {
                id: uuidv4(),
                name: name.trim(),
                description: description ? description.trim() : '',
                createdAt: new Date().toISOString()
            };
            
            groups.push(newGroup);
            saveData();
            
            res.status(201).json(newGroup);
            broadcastUpdate('groups-updated', newGroup);
        } catch (error) {
            console.error('Error creating group:', error);
            res.status(500).json({ error: 'Failed to create group', details: error.message });
        }
    };

    const handleDeleteGroups = (req, res) => {
        try {
            const { id } = req.params;
            const groupIndex = groups.findIndex(g => g.id === id);
            
            if (groupIndex === -1) {
                return res.status(404).json({ error: 'Group not found' });
            }

            // Remove group
            const deletedGroup = groups.splice(groupIndex, 1)[0];
            
            // Update files to remove group association
            files = files.map(file => 
                file.groupId === id ? { ...file, groupId: null } : file
            );
            
            saveData();
            
            res.status(200).json({ message: 'Group deleted successfully' });
            broadcastUpdate('groups-updated', { deletedGroupId: id });
        } catch (error) {
            console.error('Error deleting group:', error);
            res.status(500).json({ error: 'Failed to delete group', details: error.message });
        }
    };

    // ---- FILE SHARING API ROUTES ----
    app.get('/api/files', (req, res) => {
        try {
            const { groupId } = req.query;
            let filteredFiles = files;
            
            if (groupId) {
                filteredFiles = files.filter(f => f.groupId === groupId);
            }
            
            const result = filteredFiles.map(file => {
                const group = groups.find(g => g.id === file.groupId);
                return { 
                    ...file, 
                    groupName: group ? group.name : null,
                    // Don't expose the full file path for security
                    path: undefined
                };
            });
            
            res.json(result);
        } catch (error) {
            console.error('Error getting files:', error);
            res.status(500).json({ error: 'Failed to get files' });
        }
    });

    app.get('/api/files/:id/download', (req, res) => {
        try {
            const file = files.find(f => f.id === req.params.id);
            if (!file) {
                return res.status(404).json({ error: 'File not found' });
            }
            
            if (!fs.existsSync(file.path)) {
                return res.status(404).json({ error: 'File not found on disk' });
            }
            
            res.download(file.path, file.name, (err) => {
                if (err) {
                    console.error('Error downloading file:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Failed to download file' });
                    }
                }
            });
        } catch (error) {
            console.error('Error in download route:', error);
            res.status(500).json({ error: 'Failed to download file' });
        }
    });

    app.get('/api/groups', (req, res) => {
        try {
            res.json(groups);
        } catch (error) {
            console.error('Error getting groups:', error);
            res.status(500).json({ error: 'Failed to get groups' });
        }
    });

    // File upload route
    app.post('/api/files', upload.array('files'), handlePostFiles);
    
    // File deletion route
    app.delete('/api/files/:id', handleDeleteFiles);
    
    // Group creation route
    app.post('/api/groups', handlePostGroups);
    
    // Group deletion route
    app.delete('/api/groups/:id', handleDeleteGroups);

    console.log('File sharing routes configured');

    // Return module API for external use
    return {
        saveData,
        getFiles: () => files,
        getGroups: () => groups,
        broadcastUpdate
    };
}