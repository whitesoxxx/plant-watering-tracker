const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database(path.join(__dirname, 'plants.db'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

db.exec(`
  CREATE TABLE IF NOT EXISTS plants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '🌱',
    water_every_days INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS watering_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER NOT NULL,
    watered_at TEXT NOT NULL,
    FOREIGN KEY (plant_id) REFERENCES plants(id)
  );
`);

function computeStatus(plant, lastWatered) {
  const intervalMs = plant.water_every_days * 24 * 60 * 60 * 1000;
  let next_due = null;
  let is_overdue = true;

  if (lastWatered) {
    const nextDate = new Date(new Date(lastWatered).getTime() + intervalMs);
    next_due = nextDate.toISOString();
    is_overdue = nextDate < new Date();
  }

  return { ...plant, last_watered: lastWatered || null, next_due, is_overdue };
}

// GET all plants
app.get('/api/plants', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, MAX(l.watered_at) as last_watered
    FROM plants p
    LEFT JOIN watering_logs l ON l.plant_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at ASC
  `).all();

  res.json(rows.map(({ last_watered, ...plant }) => computeStatus(plant, last_watered)));
});

// POST create plant
app.post('/api/plants', (req, res) => {
  const { name, emoji, water_every_days } = req.body;
  if (!name || !water_every_days) {
    return res.status(400).json({ error: 'name and water_every_days are required' });
  }

  const result = db.prepare(
    'INSERT INTO plants (name, emoji, water_every_days, created_at) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), emoji || '🌱', Number(water_every_days), new Date().toISOString());

  const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(computeStatus(plant, null));
});

// DELETE plant (cascade logs)
app.delete('/api/plants/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM watering_logs WHERE plant_id = ?').run(id);
  db.prepare('DELETE FROM plants WHERE id = ?').run(id);
  res.json({ success: true });
});

// POST water a plant
app.post('/api/plants/:id/water', (req, res) => {
  const id = Number(req.params.id);
  const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });

  const watered_at = new Date().toISOString();
  const result = db.prepare(
    'INSERT INTO watering_logs (plant_id, watered_at) VALUES (?, ?)'
  ).run(id, watered_at);

  res.status(201).json({ id: result.lastInsertRowid, plant_id: id, watered_at });
});

// GET watering history
app.get('/api/plants/:id/history', (req, res) => {
  const id = Number(req.params.id);
  const logs = db.prepare(
    'SELECT * FROM watering_logs WHERE plant_id = ? ORDER BY watered_at DESC'
  ).all(id);
  res.json(logs);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Plant tracker running at http://localhost:${PORT}`));
