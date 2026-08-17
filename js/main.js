// Agent Office — Main entry

import { Office } from './canvas.js';
import { Storage } from './storage.js';
import { Audio } from './audio.js';
import { STARTER_AGENTS } from './agents.js';
import { toast, logEvent } from './utils.js';

let office = null;

function init() {
  const canvas = document.getElementById('office-canvas');
  office = new Office(canvas);

  // Settings load
  const settings = Storage.getSettings();
  document.getElementById('api-key-input').value = settings.apiKey || '';
  document.getElementById('sfx-toggle').checked = settings.sfx !== false;
  document.getElementById('music-toggle').checked = !!settings.music;
  Audio.setEnabled(settings.sfx !== false);

  bindUI();
  office.start();

  // Welcome
  setTimeout(() => {
    toast('Welcome to Agent Office. Assign a task to get started!', 'info', 4000);
  }, 800);
}

function bindUI() {
  // Top buttons
  document.getElementById('btn-decor').addEventListener('click', () => {
    office.setDecorMode(!office.decorMode);
    Audio.click();
  });
  document.getElementById('btn-exit-decor').addEventListener('click', () => {
    office.setDecorMode(false);
  });

  document.getElementById('btn-creator').addEventListener('click', () => {
    openModal('modal-creator');
    resetCreatorForm();
    Audio.click();
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    openModal('modal-settings');
    Audio.click();
  });

  document.getElementById('btn-new-task').addEventListener('click', () => {
    openTaskModal();
    Audio.click();
  });

  document.getElementById('btn-hire').addEventListener('click', () => {
    openModal('modal-creator');
    resetCreatorForm();
    Audio.click();
  });

  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.dataset.close);
    });
  });

  // Overlay click to close
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
      closeAllModals();
    }
  });

  // Task start
  document.getElementById('btn-start-task').addEventListener('click', startTaskFromModal);

  // Creator live preview
  ['creator-name', 'creator-emoji', 'creator-color'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCreatorPreview);
  });

  document.getElementById('btn-save-agent').addEventListener('click', saveCustomAgent);

  // Settings save
  document.getElementById('modal-settings').querySelector('[data-close]').addEventListener('click', saveSettings);
  // Also on primary close
  document.querySelector('#modal-settings .btn-primary')?.addEventListener('click', saveSettings);

  document.getElementById('sfx-toggle').addEventListener('change', (e) => {
    Audio.setEnabled(e.target.checked);
  });

  document.getElementById('btn-reset-data').addEventListener('click', () => {
    if (confirm('Reset all office data? This cannot be undone.')) {
      Storage.resetAll();
      location.reload();
    }
  });

  // Canvas input
  const canvas = document.getElementById('office-canvas');
  canvas.addEventListener('click', (e) => {
    const pos = office.getCanvasPos(e);
    office.handleClick(pos.x, pos.y);
  });

  window.addEventListener('keydown', (e) => office.handleKey(e));

  // Preset change fills prompt
  document.getElementById('task-preset').addEventListener('change', (e) => {
    const hints = {
      minigame: 'A tiny addictive browser game about collecting stars while avoiding bugs.',
      landing: 'Landing page for "AgentForge" — an AI agent orchestration platform.',
      tool: 'A beautiful pomodoro timer with agent-themed encouragement messages.',
      story: 'A short interactive story about the last night shift at Agent Office.',
      dashboard: 'A live-looking metrics panel for agent productivity and coffee consumption.',
      gameart: 'Art direction for a cyberpunk skateboarding game set in a neon city.'
    };
    if (hints[e.target.value]) {
      document.getElementById('task-prompt').value = hints[e.target.value];
    }
  });
}

function openModal(id) {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  // If no other modals open, hide overlay
  const anyOpen = [...document.querySelectorAll('.modal')].some(m => !m.classList.contains('hidden'));
  if (!anyOpen) {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById('modal-overlay').classList.add('hidden');
}

function openTaskModal() {
  const select = document.getElementById('task-agent-select');
  select.innerHTML = office.agents.map(a => `
    <label class="agent-select-item">
      <input type="checkbox" value="${a.id}">
      <span>${a.emoji}</span>
      <span>${a.name.split(' ')[0]}</span>
    </label>
  `).join('');

  select.querySelectorAll('.agent-select-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const cb = item.querySelector('input');
      cb.checked = !cb.checked;
      item.classList.toggle('selected', cb.checked);
    });
    item.querySelector('input').addEventListener('change', (e) => {
      item.classList.toggle('selected', e.target.checked);
    });
  });

  // Default select first free agent
  const firstFree = office.agents.find(a => !a.isBusy);
  if (firstFree) {
    const cb = select.querySelector(`input[value="${firstFree.id}"]`);
    if (cb) {
      cb.checked = true;
      cb.closest('.agent-select-item').classList.add('selected');
    }
  }

  openModal('modal-task');
}

function startTaskFromModal() {
  const preset = document.getElementById('task-preset').value;
  const prompt = document.getElementById('task-prompt').value.trim();
  const checks = [...document.querySelectorAll('#task-agent-select input:checked')];
  const agentIds = checks.map(c => c.value);
  const collabMode = document.querySelector('input[name="collab-mode"]:checked')?.value || 'solo';

  if (agentIds.length === 0) {
    toast('Pick at least one agent', 'warning');
    return;
  }
  if (!prompt && preset === 'custom') {
    toast('Write a prompt or pick a preset', 'warning');
    return;
  }

  // Check busy
  const busy = agentIds.some(id => {
    const a = office.agents.find(x => x.id === id);
    return a && a.isBusy;
  });
  if (busy) {
    toast('One or more selected agents are busy', 'warning');
    return;
  }

  office.tasks.createTask({
    prompt,
    preset: preset === 'custom' ? null : preset,
    agentIds,
    collabMode
  });

  closeAllModals();
  Audio.click();
}

function resetCreatorForm() {
  document.getElementById('creator-name').value = '';
  document.getElementById('creator-role').value = '';
  document.getElementById('creator-catchphrase').value = '';
  document.getElementById('creator-personality').value = '';
  document.getElementById('creator-system').value = '';
  document.getElementById('creator-color').value = '#7c5cfc';
  document.getElementById('creator-emoji').value = '🤖';
  document.getElementById('creator-style').value = 'coder';
  updateCreatorPreview();
}

function updateCreatorPreview() {
  const name = document.getElementById('creator-name').value || 'New Agent';
  const emoji = document.getElementById('creator-emoji').value || '🤖';
  const color = document.getElementById('creator-color').value;
  document.getElementById('creator-name-preview').textContent = name;
  const preview = document.getElementById('creator-avatar-preview');
  preview.textContent = emoji;
  preview.style.background = color + '33';
  preview.style.borderColor = color;
}

function saveCustomAgent() {
  const name = document.getElementById('creator-name').value.trim();
  const role = document.getElementById('creator-role').value.trim() || 'Custom Agent';
  const catchphrase = document.getElementById('creator-catchphrase').value.trim() || '...';
  const personality = document.getElementById('creator-personality').value.trim();
  const systemPrompt = document.getElementById('creator-system').value.trim();
  const color = document.getElementById('creator-color').value;
  const emoji = document.getElementById('creator-emoji').value || '🤖';
  const style = document.getElementById('creator-style').value;

  if (!name) {
    toast('Give your agent a name', 'warning');
    return;
  }

  const data = {
    name,
    role,
    catchphrase,
    personality,
    systemPrompt,
    color,
    emoji,
    style,
    isCustom: true
  };

  const agent = office.hireAgent(data);
  if (agent) {
    // Also keep in custom library
    const customs = Storage.getCustomAgents();
    customs.push(data);
    Storage.setCustomAgents(customs);
    closeAllModals();
  }
}

function saveSettings() {
  const settings = {
    apiKey: document.getElementById('api-key-input').value.trim(),
    sfx: document.getElementById('sfx-toggle').checked,
    music: document.getElementById('music-toggle').checked
  };
  Storage.setSettings(settings);
  Audio.setEnabled(settings.sfx);
  toast('Settings saved', 'success');
}

// Boot
document.addEventListener('DOMContentLoaded', init);
