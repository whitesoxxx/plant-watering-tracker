const grid = document.getElementById('plant-grid');
const emptyState = document.getElementById('empty-state');
const dashboard = document.getElementById('dashboard');
const historyPanel = document.getElementById('history-panel');
const historyTitle = document.getElementById('history-title');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const formOverlay = document.getElementById('form-overlay');
const addForm = document.getElementById('add-plant-form');

// Show/hide panels
document.getElementById('show-add-form').addEventListener('click', () => formOverlay.classList.remove('hidden'));
document.getElementById('cancel-form').addEventListener('click', closeForm);
formOverlay.addEventListener('click', (e) => { if (e.target === formOverlay) closeForm(); });

document.getElementById('back-btn').addEventListener('click', () => {
  historyPanel.classList.add('hidden');
  dashboard.classList.remove('hidden');
});

function closeForm() {
  formOverlay.classList.add('hidden');
  addForm.reset();
}

function formatDate(isoStr) {
  if (!isoStr) return 'Never';
  return new Date(isoStr).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDue(plant) {
  if (!plant.last_watered) return '<strong>Never watered</strong>';
  if (plant.is_overdue) {
    const days = Math.floor((Date.now() - new Date(plant.next_due)) / 86400000);
    return `<strong style="color:#c0392b">Overdue by ${days === 0 ? 'today' : days + (days === 1 ? ' day' : ' days')}</strong>`;
  }
  const days = Math.ceil((new Date(plant.next_due) - Date.now()) / 86400000);
  return `Next due: <strong>${days <= 1 ? 'tomorrow' : 'in ' + days + ' days'}</strong> (${formatDate(plant.next_due)})`;
}

function buildCard(plant) {
  const card = document.createElement('div');
  card.className = 'plant-card' + (plant.is_overdue ? ' overdue' : '');
  card.dataset.id = plant.id;

  card.innerHTML = `
    <div class="card-top">
      <span class="plant-emoji">${plant.emoji}</span>
      <div>
        <div class="plant-name">${plant.name}</div>
        ${plant.is_overdue ? '<span class="overdue-badge">Needs Water</span>' : ''}
      </div>
    </div>
    <div class="card-meta">
      Every ${plant.water_every_days} day${plant.water_every_days === 1 ? '' : 's'}<br>
      Last watered: <strong>${formatDate(plant.last_watered)}</strong><br>
      ${formatDue(plant)}
    </div>
    <div class="card-actions">
      <button class="btn btn-water" data-action="water">💧 Water Now</button>
      <button class="btn btn-history" data-action="history">History</button>
      <button class="btn btn-danger" data-action="remove">Remove</button>
    </div>
  `;
  return card;
}

async function fetchAndRender() {
  const plants = await fetch('/api/plants').then(r => r.json());

  // Sort: overdue first, then by next_due ascending, then never-watered last
  plants.sort((a, b) => {
    if (a.is_overdue && !b.is_overdue) return -1;
    if (!a.is_overdue && b.is_overdue) return 1;
    if (!a.next_due && !b.next_due) return 0;
    if (!a.next_due) return 1;
    if (!b.next_due) return -1;
    return new Date(a.next_due) - new Date(b.next_due);
  });

  grid.innerHTML = '';
  if (plants.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    plants.forEach(p => grid.appendChild(buildCard(p)));
  }
}

// Event delegation for card buttons
grid.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const card = btn.closest('.plant-card');
  const id = card.dataset.id;
  const action = btn.dataset.action;

  if (action === 'water') {
    btn.disabled = true;
    btn.textContent = 'Watering…';
    await fetch(`/api/plants/${id}/water`, { method: 'POST' });
    await fetchAndRender();
  }

  if (action === 'remove') {
    const name = card.querySelector('.plant-name').textContent;
    if (!confirm(`Remove "${name}"? This will also delete its watering history.`)) return;
    await fetch(`/api/plants/${id}`, { method: 'DELETE' });
    await fetchAndRender();
  }

  if (action === 'history') {
    const name = card.querySelector('.plant-name').textContent;
    const emoji = card.querySelector('.plant-emoji').textContent;
    const logs = await fetch(`/api/plants/${id}/history`).then(r => r.json());

    historyTitle.textContent = `${emoji} ${name} — Watering History`;
    historyList.innerHTML = '';

    if (logs.length === 0) {
      historyEmpty.classList.remove('hidden');
    } else {
      historyEmpty.classList.add('hidden');
      logs.forEach(log => {
        const li = document.createElement('li');
        li.textContent = `💧 ${formatDate(log.watered_at)}`;
        historyList.appendChild(li);
      });
    }

    dashboard.classList.add('hidden');
    historyPanel.classList.remove('hidden');
  }
});

// Add plant form submit
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('input-name').value.trim();
  const emoji = document.getElementById('input-emoji').value.trim() || '🌱';
  const water_every_days = Number(document.getElementById('input-days').value);

  if (!name || !water_every_days) return;

  await fetch('/api/plants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, emoji, water_every_days })
  });

  closeForm();
  await fetchAndRender();
});

// Initial load + auto-refresh every 60s
fetchAndRender();
setInterval(fetchAndRender, 60000);
