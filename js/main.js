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

  const settings = Storage.getSettings();
  document.getElementById('api-key-input').value = settings.apiKey || '';
  document.getElementById('sfx-toggle').checked = settings.sfx !== false;
  document.getElementById('music-toggle').checked = !!settings.music;
  Audio.setEnabled(settings.sfx !== false);

  bindUI();
  office.start();

  setTimeout(() => {
    toast('Welcome to Agent Office. Assign a task to get started!', 'info', 4000);
  }, 800);
}

function bindUI() {
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

  window.addEventListener('ao-assign-task', (e) => {
    openTaskModal(e.detail?.agentId);
    Audio.click();
  });

  document.getElementById('btn-hire').addEventListener('click', () => {
    openModal('modal-creator');
    resetCreatorForm();
    Audio.click();
  });

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeAllModals();
  });

  document.getElementById('btn-start-task').addEventListener('click', startTaskFromModal);

  ['creator-name', 'creator-emoji', 'creator-color'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCreatorPreview);
  });

  document.getElementById('btn-save-agent').addEventListener('click', saveCustomAgent);

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

  const canvas = document.getElementById('office-canvas');
  canvas.addEventListener('click', (e) => {
    const pos = office.getCanvasPos(e);
    office.handleClick(pos.x, pos.y);
  });

  window.addEventListener('keydown', (e) => office.handleKey(e));

  const PRESET_FILL = {
    minigame: {
      title: 'Playable HTML5 Mini-Game based on Top Trends',
      prompt: 'Create a fully playable, self-contained single-file HTML/CSS/JS mini-game. Prefer either an Asteroids-style shooter OR a dodge-falling-items game (coffee spills, fire, collectibles). Include score, lives/hearts, smooth keyboard controls, game-over state, and a restart hint. Make it look polished and fun.'
    },
    landing: {
      title: 'Modern AI Product Landing Page',
      prompt: 'Design a beautiful, modern single-page landing page for a fictional AI product called AgentForge. Include hero section, 3 feature cards, social proof, and a strong CTA. Pure HTML + CSS, dark cyber aesthetic.'
    },
    tool: {
      title: 'Agent-Themed Utility Tool',
      prompt: 'Build a small useful browser utility (pomodoro timer with agent encouragement messages, or a color picker / unit converter). Self-contained HTML, clean UI, no dependencies.'
    },
    story: {
      title: 'Interactive Branching Story',
      prompt: 'Write a short interactive branching text adventure that runs in the browser. Theme: the last night shift at Agent Office. Include at least 3 choice points and 2 endings. HTML + JS.'
    },
    dashboard: {
      title: 'Agent Productivity Dashboard',
      prompt: 'Create a stylish dashboard widget / mini analytics panel with fake but pretty data visualizations for agent productivity, coffee consumption, and tasks shipped. Pure HTML/CSS/JS.'
    },
    gameart: {
      title: 'Game Art Direction + Lore Package',
      prompt: 'Produce an art direction + lore package for a small game: color palette, mood keywords, character concepts, and a short lore blurb. Also include a simple visual HTML mock if possible.'
    },
    marketing: {
      title: 'Marketing Concept for Nausicaä Skateboard Shoe',
      prompt: 'Create a full marketing concept for a limited skateboard shoe drop inspired by Nausicaä. Include model name, materials story, hero launch commercial script, and targeted collab / drop strategy. Formatted and vivid.'
    },
    custom: { title: '', prompt: '' }
  };

  const cards = document.getElementById('task-preset-cards');
  if (cards) {
    cards.addEventListener('click', (e) => {
      const card = e.target.closest('.preset-card');
      if (!card) return;
      const key = card.dataset.preset;
      document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      document.getElementById('task-preset').value = key;
      const fill = PRESET_FILL[key];
      if (fill) {
        document.getElementById('task-title').value = fill.title;
        document.getElementById('task-prompt').value = fill.prompt;
      }
      Audio.click();
    });
  }
}

function openModal(id) {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  const anyOpen = [...document.querySelectorAll('.modal')].some(m => !m.classList.contains('hidden'));
  if (!anyOpen) document.getElementById('modal-overlay').classList.add('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById('modal-overlay').classList.add('hidden');
}

function openTaskModal(preferredAgentId = null) {
  const select = document.getElementById('task-agent-select');
  select.innerHTML = office.agents.map(a => {
    const busy = a.isBusy ? ' (busy)' : '';
    return `
      <button type="button" class="agent-select-item ${a.isBusy ? 'is-busy' : ''}" data-id="${a.id}" aria-pressed="false">
        <span class="asi-emoji">${a.emoji}</span>
        <span class="asi-name">${a.name.split(' ')[0]}${busy}</span>
        <span class="asi-check">✓</span>
      </button>`;
  }).join('');

  select.querySelectorAll('.agent-select-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-busy')) {
        toast('That agent is busy right now', 'warning');
        return;
      }
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('selected', on);
      Audio.click();
    });
  });

  const preferred =
    preferredAgentId ||
    office.selectedAgent?.id ||
    office.agents.find(a => !a.isBusy)?.id;

  if (preferred) {
    const btn = select.querySelector(`.agent-select-item[data-id="${preferred}"]`);
    if (btn && !btn.classList.contains('is-busy')) {
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.add('selected');
    }
  }

  document.getElementById('task-preset').value = 'custom';
  document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
  const titleEl = document.getElementById('task-title');
  if (titleEl) titleEl.value = '';
  document.getElementById('task-prompt').value = '';
  const solo = document.querySelector('input[name="collab-mode"][value="solo"]');
  if (solo) solo.checked = true;

  openModal('modal-task');
}

function startTaskFromModal() {
  const preset = document.getElementById('task-preset').value;
  const titleEl = document.getElementById('task-title');
  const title = titleEl ? titleEl.value.trim() : '';
  let prompt = document.getElementById('task-prompt').value.trim();
  const agentIds = [...document.querySelectorAll('#task-agent-select .agent-select-item.selected')]
    .map(el => el.dataset.id);
  const collabMode = document.querySelector('input[name="collab-mode"]:checked')?.value || 'solo';

  if (agentIds.length === 0) {
    toast('Pick at least one agent', 'warning');
    return;
  }
  if (!prompt && preset === 'custom') {
    toast('Write a prompt or pick a preset', 'warning');
    return;
  }

  if (title && prompt) prompt = `Title: ${title}\n\n${prompt}`;
  else if (title && !prompt) prompt = title;

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

  const data = { name, role, catchphrase, personality, systemPrompt, color, emoji, style, isCustom: true };
  const agent = office.hireAgent(data);
  if (agent) {
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

document.addEventListener('DOMContentLoaded', init);
