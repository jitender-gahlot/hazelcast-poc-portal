const router = require('express').Router();
const db = require('../db');
const logger = require('../logger');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);

function rowToPoc(row, includeInternal) {
  const poc = {
    id: row.id,
    account: row.account,
    vertical: row.vertical,
    type: row.type,
    seOwner: row.se_owner,
    aeOwner: row.ae_owner,
    stage: row.stage,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    external: row.external_data || {},
  };
  if (includeInternal) poc.internal = row.internal_data || {};
  return poc;
}

// GET /api/pocs
router.get('/', async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      ({ rows } = await db.query(
        'SELECT id, account, vertical, type, se_owner, ae_owner, stage, invite_code, created_at, updated_at FROM pocs ORDER BY created_at DESC'
      ));
    } else {
      if (!req.user.pocId) return res.json([]);
      ({ rows } = await db.query(
        'SELECT id, account, vertical, type, se_owner, ae_owner, stage, invite_code, created_at, updated_at FROM pocs WHERE id = $1',
        [req.user.pocId]
      ));
    }
    res.json(rows.map(r => rowToPoc(r, false)));
  } catch (err) {
    logger.error('List POCs error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/pocs — admin only
router.post('/', requireAdmin, async (req, res) => {
  const { account, vertical, type, seOwner, aeOwner } = req.body;
  if (!account) return res.status(400).json({ error: 'Account name required' });

  const inviteCode = 'POC-' + Math.random().toString(36).toUpperCase().slice(2, 6);

  try {
    const { rows } = await db.query(
      `INSERT INTO pocs (account, vertical, type, se_owner, ae_owner, stage, invite_code, external_data, internal_data)
       VALUES ($1,$2,$3,$4,$5,'Discovery',$6,'{}','{}') RETURNING *`,
      [account.trim(), vertical || null, type || null, seOwner || null, aeOwner || null, inviteCode]
    );
    logger.info('POC created', { pocId: rows[0].id, account: rows[0].account, userId: req.user.id });
    res.status(201).json(rowToPoc(rows[0], true));
  } catch (err) {
    logger.error('Create POC error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/pocs/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM pocs WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'POC not found' });

    if (req.user.role === 'prospect' && rows[0].id !== req.user.pocId)
      return res.status(403).json({ error: 'Forbidden' });

    res.json(rowToPoc(rows[0], req.user.role === 'admin'));
  } catch (err) {
    logger.error('Get POC error', { error: err.message, pocId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/pocs/:id
router.put('/:id', async (req, res) => {
  try {
    const { rows: existing } = await db.query('SELECT * FROM pocs WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'POC not found' });

    if (req.user.role === 'prospect' && existing[0].id !== req.user.pocId)
      return res.status(403).json({ error: 'Forbidden' });

    const { external, internal, stage } = req.body;
    const row = existing[0];

    let updated;
    if (req.user.role === 'admin') {
      ({ rows: [updated] } = await db.query(
        `UPDATE pocs
            SET external_data = $1,
                internal_data = $2,
                stage         = COALESCE($3, stage),
                updated_at    = NOW()
          WHERE id = $4
          RETURNING *`,
        [
          external  ? JSON.stringify(external)  : row.external_data,
          internal  ? JSON.stringify(internal)  : row.internal_data,
          stage     || null,
          req.params.id,
        ]
      ));
    } else {
      ({ rows: [updated] } = await db.query(
        `UPDATE pocs
            SET external_data = $1,
                updated_at    = NOW()
          WHERE id = $2
          RETURNING *`,
        [
          external ? JSON.stringify(external) : row.external_data,
          req.params.id,
        ]
      ));
    }

    logger.info('POC updated', { pocId: updated.id, userId: req.user.id });
    res.json(rowToPoc(updated, req.user.role === 'admin'));
  } catch (err) {
    logger.error('Update POC error', { error: err.message, pocId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
