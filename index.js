const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const app = express();

// Enable CORS for all routes
app.use(cors());

// API endpoint to list MP3 files from a given folder
app.get('/api/songs/:folder', async (req, res) => {
  const folder = req.params.folder;
  const directoryPath = path.join(__dirname, 'songs', folder);

  try {
    const files = await fs.promises.readdir(directoryPath);
    const mp3Files = files.filter(file => file.endsWith('.mp3'));
    res.json(mp3Files);
  } catch (error) {
    console.error('Error reading directory:', error);
    res.status(500).json({ error: 'Unable to access folder' });
  }
});

const tempStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Use the album provided in the form; default to 'default' if not provided.
      const album = (req.body.album || 'default').trim();
      const albumFolder = path.join(__dirname, 'songs', album);
      fs.mkdir(albumFolder, { recursive: true }, (err) => {
        if (err) {
          console.error('Error creating album folder:', err);
          return cb(err, albumFolder);
        }
        cb(null, albumFolder);
      });
    },
    filename: (req, file, cb) => {
      // Use a temporary filename since text fields may not be available yet.
      const ext = path.extname(file.originalname);
      // Create a temporary name using timestamp and the original file name.
      const tempName = `${Date.now()}-${file.originalname}`;
      cb(null, tempName);
    }
  });
  
  const upload = multer({ storage: tempStorage });
  
  
  
  
  // ----------------------------
  // Upload Endpoint
  // ----------------------------
  // Expecting a multipart/form-data POST with:
  // - File field: "mp3File"
  // - Text fields: "album", "songName", "singerName" (singerName can be stored later or used as needed)
  app.post('/api/upload', upload.single('mp3File'), (req, res) => {
    // Ensure that we received the file and text fields.
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Now that all fields are parsed, get the desired song and singer names.
    const ext = path.extname(req.file.originalname);
    const songName = (req.body.songName || '').toString().trim() || 'UnknownSong';
    const singerName = (req.body.singerName || '').toString().trim() || 'UnknownSinger';
    const baseName = `${songName} - ${singerName}`;
    const album = (req.body.album || 'default').toString().trim();
    
    const albumFolder = path.join(__dirname, 'songs', album);
    
    // Determine the desired final filename.
    let candidate = `${baseName}${ext}`;
    let count = 1;
    while (fs.existsSync(path.join(albumFolder, candidate))) {
      candidate = `${baseName}-${count}${ext}`;
      count++;
    }
    
    // Construct the old and new file paths.
    const oldPath = req.file.path; // path from multer (temporary name)
    const newPath = path.join(albumFolder, candidate);
    
    // Rename the file.
    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        console.error("Error renaming file:", err);
        return res.status(500).json({ error: "Error renaming file" });
      }
      res.json({
        message: 'File uploaded and renamed successfully',
        file: candidate,
        album: album
      });
    });
  });

app.get('/api/albums', async (req, res) => {
    try {
      // Read the songs directory and get directory entries (files/folders)
      const entries = await fs.promises.readdir(path.join(__dirname, 'songs'), { withFileTypes: true });
      
      // Filter to include only directories (folders) and exclude "default"
      const albums = entries
        .filter(entry => entry.isDirectory() && entry.name !== 'default')
        .map(entry => entry.name);
  
      res.json(albums);
    } catch (error) {
      console.error('Error reading albums directory:', error);
      res.status(500).json({ error: 'Unable to fetch albums' });
    }
  });
  

// Serve the MP3 files statically if needed
app.use('/songs', express.static(path.join(__dirname, 'songs')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
