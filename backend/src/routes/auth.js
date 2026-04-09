const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const logger = require('../logger');

const COOKIE_OPTS = {
  httpOnly: true,
  // Secure flag must only be set when the app is actually served over HTTPS.
  // NODE_ENV=production does NOT imply HTTPS (e.g. HTTP behind a load balancer).
  // Set COOKIE_SECURE=true in .env only after TLS is configured end-to-end.
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, pocId: user.poc_id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, pocId: user.poc_id };
}

// GET /api/auth/me — check session
router.get('/me', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ user: { id: p.id, email: p.email, name: p.name, role: p.role, pocId: p.pocId } });
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
});

// POST /api/auth/signin
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    res.cookie('token', makeToken(user), COOKIE_OPTS);
    logger.info('User signed in', { userId: user.id, role: user.role });
    res.json({ user: publicUser(user) });
  } catch (err) {
    logger.error('Sign in error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password, role, inviteCode, adminCode } = req.body;

  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!['admin', 'prospect'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });

  try {
    let pocId = null;

    if (role === 'prospect') {
      if (!inviteCode) return res.status(400).json({ error: 'Invite code required' });
      const { rows } = await db.query(
        'SELECT id FROM pocs WHERE invite_code = $1',
        [inviteCode.trim().toUpperCase()]
      );
      if (!rows[0]) return res.status(400).json({ error: 'Invite code not found. Check with your SE.' });
      pocId = rows[0].id;
    } else {
      if (adminCode !== process.env.ADMIN_REGISTRATION_CODE)
        return res.status(400).json({ error: 'Invalid internal access code' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password_hash, role, poc_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name.trim(), email.toLowerCase().trim(), passwordHash, role, pocId]
    );
    const user = rows[0];

    res.cookie('token', makeToken(user), COOKIE_OPTS);
    logger.info('User registered', { userId: user.id, role: user.role });
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    logger.error('Sign up error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/signout
router.post('/signout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

module.exports = router;
