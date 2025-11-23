// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: 'postgresql://postgres:admin@localhost:5432/notesapp' // notesapp . notesdb
});

const BLOCKFROST_PREPROD_URL = process.env.BLOCKFROST_PREPROD_URL || 'https://cardano-preprod.blockfrost.io/api/v0';
const BLOCKFROST_PREVIEW_URL = process.env.BLOCKFROST_PREVIEW_URL || 'https://cardano-preview.blockfrost.io/api/v0';
const BLOCKFROST_PREPROD_PROJECT_ID = process.env.BLOCKFROST_PREPROD_PROJECT_ID || process.env.BLOCKFROST_PROJECT_ID || '';
const BLOCKFROST_PREVIEW_PROJECT_ID = process.env.BLOCKFROST_PREVIEW_PROJECT_ID || process.env.BLOCKFROST_PROJECT_ID || '';

const getBlockfrostConfig = (network = 'preprod') => {
  const isPreview = network === 'preview';
  const projectId = isPreview ? BLOCKFROST_PREVIEW_PROJECT_ID : BLOCKFROST_PREPROD_PROJECT_ID;
  const baseUrl = isPreview ? BLOCKFROST_PREVIEW_URL : BLOCKFROST_PREPROD_URL;

  if (!projectId) {
    const error = new Error(`Blockfrost ${network} project id missing`);
    error.code = 'BLOCKFROST_CONFIG';
    throw error;
  }

  return { baseUrl, projectId };
};

const callBlockfrost = async (path, network = 'preprod', options = {}) => {
  const { baseUrl, projectId } = getBlockfrostConfig(network);
  const { rawResponse, ...rest } = options;
  const headers = {
    project_id: projectId,
    ...(rest.headers || {})
  };

  if (rest.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || 'Blockfrost request failed');
    error.status = response.status;
    throw error;
  }

  if (rawResponse) {
    return response;
  }

  return response.json();
};

// GET all notes
app.get('/notes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET single note
app.get('/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM notes WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// CREATE note
app.post('/notes', async (req, res) => {
  try {
    const { user_name, title, content } = req.body;
    const result = await pool.query(
      'INSERT INTO notes (user_name, title, content) VALUES ($1, $2, $3) RETURNING *',
      [user_name, title, content]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// UPDATE note
app.put('/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_name, title, content } = req.body;
    const result = await pool.query(
      'UPDATE notes SET user_name = $1, title = $2, content = $3 WHERE id = $4 RETURNING *',
      [user_name, title, content, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE note
app.delete('/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM notes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    res.json({ message: 'Note deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/wallet/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const network = req.query.network;

if (!network || !['preprod', 'preview'].includes(network)) {
  return res.status(400).json({
    error: 'Network must be specified: preprod or preview'
  });
}

    const payload = await callBlockfrost(`/addresses/${address}`, network);
    const lovelace = payload.amount?.find(a => a.unit === 'lovelace');
    const balanceAda = lovelace ? (Number(lovelace.quantity) / 1_000_000).toFixed(6) : '0.000000';
    res.json({
      address,
      balanceAda,
      assets: payload.amount || []
    });
  } catch (err) {
    console.error(err);
    if (err.code === 'BLOCKFROST_CONFIG') {
      return res.status(400).json({ error: `BLOCKFROST_${req.query.network?.toUpperCase() || 'PREPROD'}_PROJECT_ID missing in server environment.` });
    }
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Unable to fetch balance from Blockfrost' });
  }
});

app.post('/wallet/submit', async (req, res) => {
  try {
    const { tx, network: txNetwork } = req.body;
    if (!tx) {
      return res.status(400).json({ error: 'Missing tx payload' });
    }

    const network = txNetwork || 'preprod';
    const binary = Buffer.from(tx, 'hex');
    const response = await callBlockfrost('/tx/submit', network, {
      method: 'POST',
      headers: { 'Content-Type': 'application/cbor' },
      body: binary,
      rawResponse: true
    });
    const hash = await response.text();
    res.json({ hash: hash.trim() });
  } catch (err) {
    console.error(err);
    if (err.code === 'BLOCKFROST_CONFIG') {
      return res.status(400).json({ error: `BLOCKFROST_${(req.body.network || 'preprod').toUpperCase()}_PROJECT_ID missing in server environment.` });
    }
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Unable to submit transaction' });
  }
});

app.get('/wallet/protocol-parameters', async (req, res) => {
  try {
   const network = req.query.network;

if (!network || !['preprod', 'preview'].includes(network)) {
  return res.status(400).json({
    error: 'Network must be specified: preprod or preview'
  });
}

    const parameters = await callBlockfrost('/epochs/latest/parameters', network);
    const tip = await callBlockfrost('/blocks/latest', network);
    res.json({ parameters, tip });
  } catch (err) {
    console.error(err);
    if (err.code === 'BLOCKFROST_CONFIG') {
      return res.status(400).json({ error: `BLOCKFROST_${(req.query.network || 'preprod').toUpperCase()}_PROJECT_ID missing in server environment.` });
    }
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Unable to fetch protocol parameters' });
  }
});
console.log("Preview Key Loaded:", process.env.BLOCKFROST_PREVIEW_PROJECT_ID);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
