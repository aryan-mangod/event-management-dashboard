// Simple Express server with local JSON file storage
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import multer from 'multer';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, 'data.json');

// Helper to read/write JSON file safely
function readData() {
  try {
    if (!fs.existsSync(DATA_PATH)) return {};
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('readData error', err);
    return {};
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('writeData error', err);
  }
}

// Routes
app.get('/api/data', (req, res) => {
  res.json(readData());
});

// Reviews screenshots upload (images or PDFs). Multiple files accepted.
app.post('/api/upload-review', requireAdmin, upload.array('files', 10), (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : []
    const data = readData()
    data.reviews = Array.isArray(data.reviews) ? data.reviews : []
    const saved = files.map(f => ({
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      originalName: f.originalname,
      mime: f.mimetype,
      size: f.size,
      path: `/uploads/${path.basename(f.path)}`,
      uploadedAt: Date.now(),
    }))
    data.reviews.push(...saved)
    writeData(data)
    return res.json({ success: true, items: saved })
  } catch (err) {
    console.error('upload-review error', err)
    return res.status(500).json({ success: false, error: 'upload failed' })
  }
})

app.post('/api/data', (req, res) => {
  writeData(req.body || {});
  res.json({ success: true });
});
// Helper: get/set resource arrays inside data.json
const VALID_RESOURCES = new Set(['tracks', 'catalog', 'users', 'events']);

// expose metrics as a top-level editable resource
function getMetrics() {
  const data = readData();
  return data.metrics || null;
}

function setMetrics(metrics) {
  const data = readData();
  data.metrics = metrics;
  writeData(data);
}

function getResource(name) {
  const data = readData();
  return data[name] || [];
}

function setResource(name, arr) {
  const data = readData();
  data[name] = arr;
  writeData(data);
}

// Ensure data schema (tokens as objects, users list) exists and normalize old tokens
function ensureDataSchema() {
  const data = readData();
  let changed = false;
  if (!Array.isArray(data.tokens)) {
    data.tokens = [];
    changed = true;
  } else {
    // normalize string tokens to objects { token, userId, role }
    const normalized = data.tokens.map((t) => {
      if (typeof t === 'string') {
        return { token: t, userId: null, role: 'admin' };
      }
      return t;
    });
    // detect change
    if (JSON.stringify(normalized) !== JSON.stringify(data.tokens)) {
      data.tokens = normalized;
      changed = true;
    }
  }
  if (!Array.isArray(data.users)) {
    data.users = [];
    changed = true;
  }
  // If no users exist, create a default admin (dev only)
  if (data.users.length === 0) {
    const hashed = bcrypt.hashSync('password', 8);
    const defaultAdmin = { id: 'admin', username: 'admin', password: hashed, role: 'admin' };
    data.users.push(defaultAdmin);
    console.warn('No users found in data.json — creating default admin: admin/password (hashed)');
    changed = true;
  }
  if (changed) writeData(data);
}

ensureDataSchema();

// Simple auth middleware: expects Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const parts = String(auth).split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Unauthorized' });
  const token = parts[1];
  const data = readData();
  if (!Array.isArray(data.tokens)) return res.status(401).json({ error: 'Invalid token' });
  // cleanup expired tokens
  data.tokens = (data.tokens || []).filter((t) => !t.expiresAt || Number(t.expiresAt) > Date.now());
  writeData(data);
  const entry = data.tokens.find((t) => t && t.token === token);
  if (!entry) return res.status(401).json({ error: 'Invalid token' });
  // attach user metadata for downstream handlers
  req.user = { id: entry.userId, role: entry.role };
  next();
}

function requireAdmin(req, res, next) {
  // ensure authenticated first
  const auth = req.headers['authorization'] || '';
  const parts = String(auth).split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Unauthorized' });
  const token = parts[1];
  const data = readData();
  const entry = Array.isArray(data.tokens) && data.tokens.find((t) => t && t.token === token);
  if (!entry) return res.status(401).json({ error: 'Invalid token' });
  if (entry.expiresAt && Number(entry.expiresAt) <= Date.now()) return res.status(401).json({ error: 'Token expired' });
  if (entry.role !== 'admin') return res.status(403).json({ error: 'Admin role required' });
  req.user = { id: entry.userId, role: entry.role };
  next();
}

// Simple login endpoint (development): POST /api/login { username, password }
// Hardcoded credential: admin / password (change in production)
// Login: validate user credentials against stored users; return token object with role
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  try {
    const data = readData();
  const user = Array.isArray(data.users) && data.users.find((u) => u && String(u.username) === String(username));
  if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    // verify password: support hashed passwords and fallback to plaintext migration
    const provided = String(password || '');
    let ok = false;
    try {
      if (user.password && bcrypt.compareSync(provided, String(user.password))) {
        ok = true;
      }
    } catch (e) {
      // compareSync may throw if stored password isn't a hash — fallback below
    }
    if (!ok) {
      // fallback: if stored password equals provided plaintext, migrate to hash
      if (user.password && String(user.password) === provided) {
        const data2 = readData();
        // update the user's password to hashed
        data2.users = (data2.users || []).map((u) => (String(u.id) === String(user.id) ? { ...u, password: bcrypt.hashSync(provided, 8) } : u));
        writeData(data2);
        ok = true;
      }
    }
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    // generate token tied to user id and role
    const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
  data.tokens = data.tokens || [];
  data.tokens.push({ token, userId: user.id, role: user.role || 'user', expiresAt });
    writeData(data);
    return res.json({ success: true, token, role: user.role || 'user' });
  } catch (err) {
    console.error('Login handler error', err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, error: String(err && err.message ? err.message : err) });
  }
});

// Users management endpoints (admin only for create/update/delete)
app.get('/api/users', requireAuth, (req, res) => {
  const data = readData();
  // return users without passwords
  const users = (data.users || []).map((u) => ({ id: u.id, username: u.username, role: u.role }));
  res.json(users);
});

app.post('/api/users', requireAdmin, (req, res) => {
  const payload = req.body || {};
  const data = readData();
  const users = data.users || [];
  const id = String(payload.id || `u_${Date.now()}`);
  const hashed = payload.password ? bcrypt.hashSync(String(payload.password), 8) : bcrypt.hashSync('changeme', 8);
  const newUser = { id, username: String(payload.username || ''), password: hashed, role: payload.role === 'admin' ? 'admin' : 'user' };
  users.push(newUser);
  data.users = users;
  writeData(data);
  return res.json({ success: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
});

app.put('/api/users/:id', requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const data = readData();
  const body = { ...req.body };
  if (body.password) body.password = bcrypt.hashSync(String(body.password), 8);
  data.users = (data.users || []).map((u) => (String(u.id) === id ? { ...u, ...body } : u));
  writeData(data);
  res.json({ success: true });
});

// Logout: invalidate token
app.post('/api/logout', requireAuth, (req, res) => {
  const auth = req.headers['authorization'] || '';
  const parts = String(auth).split(' ');
  const token = parts[1];
  const data = readData();
  data.tokens = (data.tokens || []).filter((t) => t.token !== token);
  writeData(data);
  res.json({ success: true });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const data = readData();
  data.users = (data.users || []).filter((u) => String(u.id) !== id);
  writeData(data);
  res.json({ success: true });
});

// Compatibility endpoint: append to tracks
app.post('/api/add-track', (req, res) => {
  const item = req.body || {};
  const tracks = getResource('tracks');
  const nextSr = tracks.length > 0 ? Math.max(...tracks.map(t => Number(t.sr || 0))) + 1 : 1;
  const newItem = { ...item, sr: Number(item.sr || nextSr) };
  tracks.push(newItem);
  setResource('tracks', tracks);
  res.json({ success: true, item: newItem });
});

// Generic CSV upload: ?resource=tracks|catalog|users|events (defaults to tracks)
app.post('/api/upload-csv', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const resource = String(req.query.resource || 'tracks');
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      try {
        const existing = getResource(resource);
        const merged = (existing || []).concat(results);
        setResource(resource, merged);
        res.json({ success: true, resource, tracks: results });
      } catch (err) {
        console.error('CSV save error', err);
        res.status(500).json({ success: false, error: 'CSV save error' });
      } finally {
        fs.unlink(req.file.path, (err) => { if (err) console.warn('cleanup error', err); });
      }
    })
    .on('error', (err) => {
      console.error('CSV parse error', err);
      res.status(500).json({ success: false, error: 'CSV parse error' });
      fs.unlink(req.file.path, () => {});
    });
});

// Generic resource endpoints (GET, POST append, PUT update by id/sr, DELETE by id/sr)
// Return current user info based on token
app.get('/api/me', requireAuth, (req, res) => {
  try {
    const data = readData();
    const userId = req.user && req.user.id;
    const user = (data.users || []).find((u) => String(u.id) === String(userId));
    if (!user) return res.json({ id: userId, role: req.user && req.user.role ? req.user.role : 'user' });
    return res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err) {
    return res.status(500).json({ error: 'me lookup failed' });
  }
});

// metrics endpoints (must be defined before the generic /api/:resource route)
app.get('/api/metrics', (req, res) => {
  const metrics = getMetrics();
  if (!metrics) return res.status(404).json({ error: 'No metrics found' });
  res.json(metrics);
});

app.put('/api/metrics', requireAdmin, (req, res) => {
  const payload = req.body || {};
  setMetrics(payload);
  res.json({ success: true, metrics: payload });
});

app.get('/api/:resource', (req, res) => {
  const resource = String(req.params.resource);
  if (!VALID_RESOURCES.has(resource)) return res.status(404).json({ error: 'Unknown resource' });
  res.json(getResource(resource));
});

app.post('/api/:resource', requireAdmin, (req, res) => {
  const resource = String(req.params.resource);
  if (!VALID_RESOURCES.has(resource)) return res.status(404).json({ error: 'Unknown resource' });
  const item = req.body || {};
  const list = getResource(resource) || [];
  if (resource === 'users') {
    const id = String(item.id || Date.now().toString());
    const newItem = { ...item, id };
    list.push(newItem);
    setResource(resource, list);
    return res.json({ success: true, item: newItem });
  }
  // default: assign numeric sr
  const nextSr = list.length > 0 ? Math.max(...list.map(t => Number(t.sr || 0))) + 1 : 1;
  const newItem = { ...item, sr: Number(item.sr || nextSr) };
  list.push(newItem);
  setResource(resource, list);
  res.json({ success: true, item: newItem });
});

app.put('/api/:resource/:id', requireAdmin, (req, res) => {
  const resource = String(req.params.resource);
  const id = req.params.id;
  if (!VALID_RESOURCES.has(resource)) return res.status(404).json({ error: 'Unknown resource' });
  const list = getResource(resource) || [];
  const updated = list.map((it) => {
    if (resource === 'users') {
      if (String(it && it.id) === id) return { ...it, ...req.body };
    } else {
      if (String(it && it.sr) === id) return { ...it, ...req.body };
    }
    return it;
  });
  setResource(resource, updated);
  res.json({ success: true });
});

app.delete('/api/:resource/:id', requireAdmin, (req, res) => {
  const resource = String(req.params.resource);
  const id = req.params.id;
  if (!VALID_RESOURCES.has(resource)) return res.status(404).json({ error: 'Unknown resource' });
  const list = getResource(resource) || [];
  const filtered = list.filter((it) => {
    if (resource === 'users') return String(it && it.id) !== id;
    return String(it && it.sr) !== id;
  }).map((t, idx) => {
    // renumber sr for non-users
    if (resource !== 'users') return { ...t, sr: idx + 1 };
    return t;
  });
  setResource(resource, filtered);
  res.json({ success: true });
});

// Return current user info based on token
app.get('/api/me', requireAuth, (req, res) => {
  try {
    const data = readData();
    const userId = req.user && req.user.id;
    const user = (data.users || []).find((u) => String(u.id) === String(userId));
    if (!user) return res.json({ id: userId, role: req.user && req.user.role ? req.user.role : 'user' });
    return res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err) {
    return res.status(500).json({ error: 'me lookup failed' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

// Global error handler to capture uncaught errors in routes
app.use((err, req, res, next) => {
  console.error('Express error handler caught:', err && err.stack ? err.stack : err);
  res.status(500).json({ error: String(err && err.message ? err.message : err) });
});
