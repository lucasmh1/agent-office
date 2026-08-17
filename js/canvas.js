// Office canvas rendering & interaction

import { Agent, STARTER_AGENTS, STATES } from './agents.js';
import { FurnitureManager, FURNITURE_TYPES } from './furniture.js';
import { TaskManager } from './tasks.js';
import { EventSystem } from './events.js';
import { Storage } from './storage.js';
import { Audio } from './audio.js';
import { dist, formatMoney, logEvent, toast, uid } from './utils.js';

export class Office {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.cellSize = 20;
    this.gridW = Math.ceil(this.width / this.cellSize);
    this.gridH = Math.ceil(this.height / this.cellSize);

    this.agents = [];
    this.furniture = new FurnitureManager(this);
    this.tasks = new TaskManager(this);
    this.events = new EventSystem(this);

    this.economy = Storage.getEconomy();
    this.upgrades = Storage.getUpgrades();
    this.selectedAgent = null;
    this.selectedFurniture = null;
    this.decorMode = false;
    this.hoverPos = null;

    this.lastTime = performance.now();
    this.fps = 60;
    this.frameCount = 0;
    this.fpsTimer = 0;

    this.init();
  }

  init() {
    // Load or create agents
    const saved = Storage.getAgents();
    if (saved && saved.length) {
      this.agents = saved.map(d => new Agent(d, this));
    } else {
      this.agents = STARTER_AGENTS.map(d => new Agent({ ...d }, this));
      // Place starters in Dev & Design Pod + Growth Lab
      const starts = [
        { x: 140, y: 360 },
        { x: 270, y: 360 },
        { x: 580, y: 360 },
        { x: 720, y: 360 }
      ];
      this.agents.forEach((a, i) => {
        a.x = starts[i]?.x ?? 300 + i * 80;
        a.y = starts[i]?.y ?? 380;
      });
    }

    // Furniture
    this.furniture.load(Storage.getFurniture());

    // UI bindings later in main
    this.renderAgentList();
    this.renderUpgrades();
    this.updateStats();
    this.tasks.renderTaskList();

    // Start some idle behavior
    this.agents.forEach(a => {
      a.goIdle();
      a.stateTimer = Math.random() * 4;
    });

    logEvent('Office online. Agents are restless.');
  }

  getObstacles() {
    return this.furniture.getObstacles();
  }

  findNearestFurniture(x, y, type) {
    return this.furniture.findNearest(x, y, type);
  }

  randomWalkable() {
    for (let i = 0; i < 20; i++) {
      const x = 60 + Math.random() * (this.width - 120);
      const y = 60 + Math.random() * (this.height - 120);
      const obs = this.getObstacles();
      if (!obs.some(o => dist(x, y, o.x, o.y) < (o.r || 25))) {
        return { x, y };
      }
    }
    return { x: this.width / 2, y: this.height / 2 };
  }

  addMoney(amount) {
    this.economy.money += amount;
    Storage.setEconomy(this.economy);
    this.updateStats();
    if (amount > 0) Audio.coin();
  }

  addReputation(amount) {
    this.economy.reputation += amount;
    Storage.setEconomy(this.economy);
    this.updateStats();
  }

  canAfford(cost) {
    return this.economy.money >= cost;
  }

  spend(cost) {
    if (!this.canAfford(cost)) return false;
    this.economy.money -= cost;
    Storage.setEconomy(this.economy);
    this.updateStats();
    return true;
  }

  hireAgent(data) {
    const cost = data.isCustom ? 150 : 200;
    if (!this.spend(cost)) {
      toast('Not enough credits', 'error');
      return null;
    }
    const agent = new Agent({
      ...data,
      id: uid(),
      x: 100 + Math.random() * 200,
      y: 200 + Math.random() * 200
    }, this);
    this.agents.push(agent);
    agent.goIdle();
    this.persistAgents();
    this.renderAgentList();
    this.updateStats();
    Audio.hire();
    logEvent(`Hired ${agent.name}!`, true);
    toast(`Welcome ${agent.name.split(' ')[0]}!`, 'success');
    return agent;
  }

  persistAgents() {
    Storage.setAgents(this.agents);
  }

  persistFurniture() {
    Storage.setFurniture(this.furniture.getSerializable());
  }

  updateStats() {
    document.getElementById('money-display').textContent = formatMoney(this.economy.money);
    document.getElementById('rep-display').textContent = this.economy.reputation;
    document.getElementById('agent-count').textContent = this.agents.length;
    document.getElementById('agent-list-count').textContent = this.agents.length;
  }

  renderAgentList() {
    const el = document.getElementById('agent-list');
    if (!el) return;
    el.innerHTML = this.agents.map(a => `
      <div class="agent-card ${a.selected ? 'selected' : ''} ${a.isBusy ? 'busy' : ''}" data-id="${a.id}">
        <div class="agent-avatar" style="background:${a.color}33;border-color:${a.color}">${a.emoji}</div>
        <div class="agent-info">
          <div class="agent-name">${a.name}</div>
          <div class="agent-role">${a.role}</div>
        </div>
        <div class="agent-status ${a.state}">${a.state}</div>
      </div>
    `).join('');

    el.querySelectorAll('.agent-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.selectAgent(this.agents.find(a => a.id === id));
      });
    });
  }

  selectAgent(agent) {
    this.agents.forEach(a => a.selected = false);
    this.selectedFurniture = null;
    if (agent) {
      agent.selected = true;
      this.selectedAgent = agent;
      this.showAgentDetail(agent);
    } else {
      this.selectedAgent = null;
      document.getElementById('selection-content').innerHTML = '<div class="empty-state">Click an agent or furniture</div>';
    }
    this.renderAgentList();
  }

  showAgentDetail(a) {
    const el = document.getElementById('selection-content');
    el.innerHTML = `
      <div class="selection-detail">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <div class="agent-avatar" style="width:48px;height:48px;font-size:24px;background:${a.color}33;border-color:${a.color}">${a.emoji}</div>
          <div>
            <div style="font-weight:700">${a.name}</div>
            <div style="font-size:12px;color:var(--text-muted)">${a.role}</div>
          </div>
        </div>
        <div class="detail-row"><span class="label">Status</span><span>${a.state}</span></div>
        <div class="detail-row"><span class="label">Style</span><span>${a.style}</span></div>
        <div class="detail-row"><span class="label">Catchphrase</span><span style="font-style:italic">"${a.catchphrase}"</span></div>
        ${a.isBusy ? `<div class="detail-row"><span class="label">Progress</span><span>${Math.round(a.progress * 100)}%</span></div>` : ''}
        <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">${a.personality || ''}</p>
      </div>
    `;
  }

  updateSelectionIfNeeded() {
    if (this.selectedAgent) this.showAgentDetail(this.selectedAgent);
  }

  renderUpgrades() {
    const list = document.getElementById('upgrades-list');
    const upgrades = [
      { id: 'extra_desk', name: 'Extra Desk', desc: '+1 desk for productivity', cost: 180 },
      { id: 'better_coffee', name: 'Premium Coffee', desc: 'Agents work slightly faster', cost: 220 },
      { id: 'neon_walls', name: 'Neon Package', desc: 'Office looks cooler', cost: 150 },
      { id: 'server_boost', name: 'Server Boost', desc: 'Faster task generation', cost: 300 }
    ];
    list.innerHTML = upgrades.map(u => {
      const owned = this.upgrades[u.id];
      return `
        <div class="upgrade-card ${owned ? 'owned' : ''}">
          <div class="upgrade-info">
            <div class="upgrade-name">${u.name}</div>
            <div class="upgrade-desc">${u.desc}</div>
          </div>
          ${owned ? '<span style="color:var(--success);font-size:12px;">Owned</span>' :
            `<button class="btn btn-sm btn-primary" data-upgrade="${u.id}" data-cost="${u.cost}">${u.cost} 💰</button>`}
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-upgrade]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.upgrade;
        const cost = +btn.dataset.cost;
        if (this.spend(cost)) {
          this.upgrades[id] = true;
          Storage.setUpgrades(this.upgrades);
          this.renderUpgrades();
          toast(`Unlocked ${id.replace('_', ' ')}!`, 'success');
          Audio.success();
          if (id === 'extra_desk') {
            this.furniture.add('desk', 500 + Math.random() * 100, 400);
            this.persistFurniture();
          }
        } else {
          toast('Not enough credits', 'error');
        }
      });
    });
  }

  setDecorMode(on) {
    this.decorMode = on;
    this.canvas.classList.toggle('decor-mode', on);
    document.getElementById('decor-toolbar').classList.toggle('hidden', !on);
    if (on) {
      this.buildFurniturePalette();
      toast('Decor Mode: click to place, or drag existing items', 'info');
    } else {
      this.furniture.selectedType = null;
      this.persistFurniture();
    }
  }

  buildFurniturePalette() {
    const palette = document.getElementById('furniture-palette');
    palette.innerHTML = Object.values(FURNITURE_TYPES).map(t => `
      <button class="furniture-btn" data-type="${t.id}" title="${t.name}">${t.emoji}</button>
    `).join('');
    palette.querySelectorAll('.furniture-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        palette.querySelectorAll('.furniture-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.furniture.selectedType = btn.dataset.type;
        Audio.click();
      });
    });
  }

  // Main loop
  update(dt) {
    this.agents.forEach(a => a.update(dt));
    this.events.update(dt);

    // Refresh agent list status occasionally
    this.frameCount++;
    if (this.frameCount % 30 === 0) {
      this.renderAgentList();
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Background base
    ctx.fillStyle = '#0f1219';
    ctx.fillRect(0, 0, this.width, this.height);

    // Soft grid
    ctx.strokeStyle = 'rgba(40, 48, 68, 0.45)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.width; x += this.cellSize) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, this.height);
      ctx.stroke();
    }
    for (let y = 0; y <= this.height; y += this.cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(this.width, y + 0.5);
      ctx.stroke();
    }

    // === ZONES (inspired by Antigravity version) ===
    const zones = [
      { name: 'RECHARGE KITCHEN', x: 40, y: 40, w: 280, h: 160, color: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.35)', label: '#4ade80' },
      { name: 'STRATEGY & WHITEBOARD', x: 350, y: 40, w: 320, h: 140, color: 'rgba(59, 130, 246, 0.07)', border: 'rgba(59, 130, 246, 0.35)', label: '#60a5fa' },
      { name: 'CLOUD NODES', x: 700, y: 40, w: 360, h: 160, color: 'rgba(168, 85, 247, 0.07)', border: 'rgba(168, 85, 247, 0.3)', label: '#c084fc' },
      { name: 'DEV & DESIGN POD', x: 40, y: 230, w: 420, h: 280, color: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.35)', label: '#a5b4fc' },
      { name: 'GROWTH & TREND LAB', x: 490, y: 230, w: 340, h: 280, color: 'rgba(236, 72, 153, 0.07)', border: 'rgba(236, 72, 153, 0.3)', label: '#f9a8d4' },
      { name: 'ZEN LOUNGE', x: 860, y: 230, w: 200, h: 280, color: 'rgba(245, 158, 11, 0.07)', border: 'rgba(245, 158, 11, 0.3)', label: '#fcd34d' }
    ];

    for (const z of zones) {
      // Zone fill
      ctx.fillStyle = z.color;
      roundRectPath(ctx, z.x, z.y, z.w, z.h, 12);
      ctx.fill();

      // Zone border
      ctx.strokeStyle = z.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Zone label
      ctx.font = '600 11px Space Grotesk, system-ui, sans-serif';
      ctx.fillStyle = z.label;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(z.name, z.x + 12, z.y + 10);
    }

    // Subtle top/bottom vignette
    const gradTop = ctx.createLinearGradient(0, 0, 0, 50);
    gradTop.addColorStop(0, 'rgba(8,10,16,0.6)');
    gradTop.addColorStop(1, 'rgba(8,10,16,0)');
    ctx.fillStyle = gradTop;
    ctx.fillRect(0, 0, this.width, 50);

    // Furniture
    this.furniture.draw(ctx);

    // Agents (sort by y for depth)
    const sorted = [...this.agents].sort((a, b) => a.y - b.y);
    sorted.forEach(a => a.draw(ctx));

    // Speech bubbles via DOM
    this.updateSpeechBubbles();
  }

  updateSpeechBubbles() {
    const layer = document.getElementById('speech-layer');
    if (!layer) return;

    const existing = new Map();
    layer.querySelectorAll('.speech-bubble').forEach(el => {
      existing.set(el.dataset.agentId, el);
    });

    const canvasRect = this.canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / this.width;
    const scaleY = canvasRect.height / this.height;

    this.agents.forEach(a => {
      if (!a.speech) {
        if (existing.has(a.id)) existing.get(a.id).remove();
        return;
      }
      let el = existing.get(a.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'speech-bubble';
        el.dataset.agentId = a.id;
        layer.appendChild(el);
      }
      el.textContent = a.speech;
      const left = (a.x * scaleX) - 20;
      const top = (a.y * scaleY) - 55;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    });
  }

  // Input
  handleClick(x, y) {
    if (this.decorMode) {
      if (this.furniture.selectedType) {
        this.furniture.add(this.furniture.selectedType, x, y);
        this.persistFurniture();
        Audio.click();
        return;
      }
      const hit = this.furniture.items.find(f =>
        dist(x, y, f.x, f.y) < Math.max(f.w, f.h) * 0.5
      );
      if (hit) {
        this.selectedFurniture = hit;
        toast(`${hit.name} selected — press Delete to remove`, 'info');
      }
      return;
    }

    // Select agent
    const hit = [...this.agents].reverse().find(a => dist(x, y, a.x, a.y) < 22);
    if (hit) {
      this.selectAgent(hit);
      Audio.click();
    } else {
      this.selectAgent(null);
    }
  }

  handleKey(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.decorMode && this.selectedFurniture) {
        this.furniture.remove(this.selectedFurniture.id);
        this.selectedFurniture = null;
        this.persistFurniture();
        toast('Furniture removed', 'info');
      }
    }
    if (e.key === 'Escape') {
      if (this.decorMode) this.setDecorMode(false);
    }
  }

  // Coordinate transform from mouse event
  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.update(dt);
    this.draw();

    // FPS
    this.fpsTimer += dt;
    this.frameCount++;
    if (this.fpsTimer >= 1) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;
      const fpsEl = document.getElementById('fps-counter');
      if (fpsEl) fpsEl.textContent = `${this.fps} FPS`;
    }

    requestAnimationFrame(t => this.loop(t));
  }

  start() {
    requestAnimationFrame(t => this.loop(t));
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
