// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const basicAuth = require('express-basic-auth');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const sanitizeHtml = require('sanitize-html');

const PORT = process.env.PORT || 3000;
const NAMES_FILE = path.join(__dirname, 'names.json');

if (!fs.existsSync(NAMES_FILE)) {
  fs.writeFileSync(NAMES_FILE, JSON.stringify([]), 'utf8');
}

const app = express();

app.use(helmet());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many submissions. Please wait a moment.' }
});

function readNames() {
  try {
    return JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}

function writeNames(list) {
  fs.writeFileSync(NAMES_FILE, JSON.stringify(list, null, 2), 'utf8');
}

app.post('/api/submit', submitLimiter, (req, res) => {
  try {
    let name = (req.body.name || '').toString().trim();
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    name = sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} }).slice(0, 200);

    const entry = {
      name,
      submittedAt: new Date().toISOString()
    };

    const names = readNames();
    names.push(entry);
    writeNames(names);

    res.json({ ok: true, message: 'Thanks! Your name was submitted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'password123';

app.use(['/admin', '/api/names'], basicAuth({
  users: { [ADMIN_USER]: ADMIN_PASS },
  challenge: true,
  realm: 'Owner Area'
}));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/names', (req, res) => {
  res.json({ ok: true, data: readNames() });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});