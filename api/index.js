const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();

// Enable CORS for all routes
app.use(cors());

// Set the base path for the songs directory (located at root/songs)
const songsBasePath = path.join(__dirname, '..', 'songs');

// ------------------------------
// API Endpoint: List MP3 files in a folder
// ------------------------------
app.get('/api/songs/:folder', async (req, res) => {
  const folder = req.params.folder;
  const directoryPath = path.join(songsBasePath, folder);
  try {
    const files = await fs.promises.readdir(directoryPath);
    const mp3Files = files.filter(file => file.endsWith('.mp3'));
    res.json(mp3Files);
  } catch (error) {
    console.error('Error reading directory:', error);
    res.status(500).json({ error: 'Unable to access folder' });
  }
});

// ------------------------------
// Multer configuration: Temporary storage
// ------------------------------
// We use temporary filenames first, then rename them in the route handler.
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use the album provided in the form; default to 'default'
    const album = (req.body.album || 'default').trim();
    const albumFolder = path.join(songsBasePath, album);
    fs.mkdir(albumFolder, { recursive: true }, (err) => {
      if (err) {
        console.error('Error creating album folder:', err);
        return cb(err, albumFolder);
      }
      cb(null, albumFolder);
    });
  },
  filename: (req, file, cb) => {
    // Save with a temporary filename; text fields may not be available yet.
    const ext = path.extname(file.originalname);
    const tempName = `${Date.now()}-${file.originalname}`;
    cb(null, tempName);
  }
});

const upload = multer({ storage: tempStorage });

// ------------------------------
// API Endpoint: Upload and rename file
// ------------------------------
app.post('/api/upload', upload.single('mp3File'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Now that all fields are available, construct the desired filename.
  const ext = path.extname(req.file.originalname);
  const songName = (req.body.songName || '').toString().trim() || 'UnknownSong';
  const singerName = (req.body.singerName || '').toString().trim() || 'UnknownSinger';
  const baseName = `${songName} - ${singerName}`;
  const album = (req.body.album || 'default').toString().trim();

  const albumFolder = path.join(songsBasePath, album);

  // Determine the final filename.
  let candidate = `${baseName}${ext}`;
  let count = 1;
  while (fs.existsSync(path.join(albumFolder, candidate))) {
    candidate = `${baseName}-${count}${ext}`;
    count++;
  }

  // Rename the file from its temporary name to the candidate filename.
  const oldPath = req.file.path;
  const newPath = path.join(albumFolder, candidate);

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

// ------------------------------
// API Endpoint: List available albums (excluding "default")
// ------------------------------
app.get('/api/albums', async (req, res) => {
  try {
    const entries = await fs.promises.readdir(songsBasePath, { withFileTypes: true });
    const albums = entries
      .filter(entry => entry.isDirectory() && entry.name !== 'default')
      .map(entry => entry.name);
    res.json(albums);
  } catch (error) {
    console.error('Error reading albums directory:', error);
    res.status(500).json({ error: 'Unable to fetch albums' });
  }
});

// ------------------------------
// Serve MP3 files statically
// ------------------------------
app.use('/songs', express.static(songsBasePath));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
