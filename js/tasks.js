// Task system with multi-agent collaboration support

import { uid, pick, randomRange } from './utils.js';
import { generateForAgent, generateCollaborative, extractHTML } from './llm2.js';
import { Audio } from './audio.js';
import { logEvent, toast } from './utils.js';
import { Storage } from './storage.js';

const PRESET_PROMPTS = {
  minigame: 'Create a fully playable, self-contained single-file HTML/CSS/JS mini-game. Prefer Asteroids-style or dodge-falling-items. Include score, lives, controls, and game-over.',
  landing: 'Design a beautiful, modern single-page landing page for a fictional AI product. Include hero, features, and a CTA. Use pure HTML/CSS.',
  tool: 'Build a small useful browser utility (e.g. color picker, unit converter, pomodoro, markdown preview). Self-contained HTML.',
  story: 'Write a short interactive branching story or text adventure that runs in the browser. HTML + JS.',
  dashboard: 'Create a stylish dashboard widget or mini analytics panel with fake but pretty data visualizations. Pure HTML/CSS/JS.',
  gameart: 'Produce an art direction + lore package for a small game: color palette, mood, character concepts, and a short lore blurb.',
  marketing: 'Create a full marketing concept for a limited product drop. Include model name, materials story, hero commercial script, and drop strategy.'
};

export class TaskManager {
  constructor(office) {
    this.office = office;
    this.active = [];
    this.completed = Storage.getCompletedTasks();
  }

  createTask({ prompt, preset, agentIds, collabMode }) {
    const agents = agentIds
      .map(id => this.office.agents.find(a => a.id === id))
      .filter(Boolean);

    if (agents.length === 0) {
      toast('Select at least one agent', 'warning');
      return null;
    }

    const finalPrompt = preset && PRESET_PROMPTS[preset]
      ? PRESET_PROMPTS[preset] + '\n\nExtra instructions: ' + (prompt || 'Make it great.')
      : (prompt || 'Create something interesting and useful.');

    const isCollab = collabMode === 'collab' && agents.length > 1;

    const task = {
      id: uid(),
      prompt: finalPrompt,
      preset: preset || 'custom',
      agents: agents.map(a => a.id),
      agentNames: agents.map(a => a.name),
      isCollab: isCollab,
      progress: 0,
      agentProgress: Object.fromEntries(agents.map(a => [a.id, 0])),
      status: 'running',
      startedAt: Date.now(),
      result: null,
      html: null
    };

    this.active.push(task);
    this.renderTaskList();

    if (isCollab) {
      const meeting = this.office.furniture.getCollabPoint();
      agents.forEach(function(a, i) {
        const partner = agents[(i + 1) % agents.length];
        a.startCollaborating(task.id, partner, meeting);
      });
      Audio.collaborate();
      logEvent(agents.map(function(a) { return a.name.split(' ')[0]; }).join(' + ') + ' started collaborating', true);
    } else {
      const lead = agents[0];
      lead.startWorking(task.id);
      logEvent(lead.name + ' started task: ' + finalPrompt.slice(0, 50) + '...');
    }

    this.runTask(task, agents);
    return task;
  }

  async runTask(task, agents) {
    const duration = randomRange(8, 16);
    const start = performance.now();
    const self = this;
    const tick = function() {
      if (task.status !== 'running') return;
      const elapsed = (performance.now() - start) / 1000;
      const t = Math.min(1, elapsed / duration);
      task.progress = t;
      agents.forEach(function(a, i) {
        const offset = i * 0.08;
        const ap = Math.max(0, Math.min(1, (t - offset) / (1 - offset * agents.length * 0.3)));
        task.agentProgress[a.id] = ap;
        a.progress = ap;
      });
      self.renderTaskList();
      self.office.updateSelectionIfNeeded();
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    try {
      var result;
      if (task.isCollab) {
        result = await generateCollaborative(agents, task.prompt);
      } else {
        result = await generateForAgent(agents[0], task.prompt);
        result.parts = [{ agent: agents[0], text: result.text, source: result.source }];
      }

      const remaining = duration * 1000 - (performance.now() - start);
      if (remaining > 0) await new Promise(function(r) { setTimeout(r, remaining); });

      task.status = 'done';
      task.result = result.text;
      task.html = result.html || extractHTML(result.text);
      task.finishedAt = Date.now();
      task.source = result.source;

      const reward = 40 + agents.length * 25 + (task.isCollab ? 30 : 0);
      this.office.addMoney(reward);
      this.office.addReputation(agents.length + (task.isCollab ? 2 : 1));

      agents.forEach(function(a) {
        a.goIdle();
        a.say(pick(['Done!', 'Shipped.', 'Not bad.', 'Next?', 'That was fun.']), 2.5);
      });

      Audio.success();
      logEvent('Task complete! +' + reward + ' credits', true);
      toast('Task complete · +' + reward + ' 💰', 'success');

      this.showResult(task);
      Storage.addCompletedTask({
        id: task.id,
        prompt: task.prompt.slice(0, 120),
        agents: task.agentNames,
        isCollab: task.isCollab,
        reward: reward,
        at: Date.now()
      });

      this.active = this.active.filter(function(t) { return t.id !== task.id; });
      this.renderTaskList();
    } catch (err) {
      console.error(err);
      task.status = 'failed';
      agents.forEach(function(a) { a.goIdle(); });
      toast('Task failed — try again', 'error');
      this.active = this.active.filter(function(t) { return t.id !== task.id; });
      this.renderTaskList();
    }
  }

  showResult(task) {
    const modal = document.getElementById('modal-result');
    const body = document.getElementById('result-content');
    const title = document.getElementById('result-title');
    if (!modal || !body) return;

    title.textContent = task.agentNames.join(' + ') + ' — Result';
    var html = '';
    if (task.html) {
      html += '<div class="result-preview"><iframe id="result-iframe" sandbox="allow-scripts" style="width:100%;height:280px;border:1px solid #2a3344;border-radius:6px;background:#fff"></iframe></div>';
      html += '<pre class="result-content" style="margin-top:12px;max-height:160px;overflow:auto">' + escapeHtml(task.result) + '</pre>';
    } else {
      html += '<pre class="result-content">' + escapeHtml(task.result) + '</pre>';
    }
    body.innerHTML = html;

    if (task.html) {
      var iframe = document.getElementById('result-iframe');
      if (iframe) iframe.srcdoc = task.html;
    }

    document.getElementById('modal-overlay').classList.remove('hidden');
    document.querySelectorAll('.modal').forEach(function(m) { m.classList.add('hidden'); });
    modal.classList.remove('hidden');
  }

  renderTaskList() {
    const el = document.getElementById('task-list');
    if (!el) return;
    if (!this.active.length) {
      el.innerHTML = '<div class="empty-state">No active tasks</div>';
      return;
    }
    el.innerHTML = this.active.map(function(t) {
      return '<div class="task-card"><div class="task-agents">' +
        t.agentNames.map(function(n) { return n.split(' ')[0]; }).join(' + ') +
        '</div><div class="task-prompt">' + t.prompt.slice(0, 60) + '...</div>' +
        '<div class="task-progress"><div class="bar" style="width:' + Math.round(t.progress * 100) + '%"></div></div></div>';
    }).join('');
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}
