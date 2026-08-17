// Task system with multi-agent collaboration support

import { uid, pick, randomRange } from './utils.js';
import { generateForAgent, generateCollaborative, extractHTML } from './llm2.js';
import { Audio } from './audio.js';
import { logEvent, toast } from './utils.js';
import { Storage } from './storage.js';

const PRESET_PROMPTS = {
  minigame: 'Create a fully playable mini-game. Prefer Asteroids-style or dodge-falling-items.',
  landing: 'Design a modern single-page landing page. Pure HTML/CSS.',
  tool: 'Build a small browser utility. Self-contained HTML.',
  story: 'Write a short interactive branching story. HTML + JS.',
  dashboard: 'Create a stylish dashboard widget with fake data.',
  gameart: 'Produce an art direction + lore package for a small game.',
  marketing: 'Create a full marketing concept for a limited product drop.'
};

export class TaskManager {
  constructor(office) {
    this.office = office;
    this.active = [];
    this.completed = Storage.getCompletedTasks();
  }

  createTask(opts) {
    var prompt = opts.prompt;
    var preset = opts.preset;
    var agentIds = opts.agentIds;
    var collabMode = opts.collabMode;
    var agents = agentIds.map(function(id) { return officeAgentsFind(this, id); }.bind(this)).filter(Boolean);

    function officeAgentsFind(self, id) {
      return self.office.agents.find(function(a) { return a.id === id; });
    }

    if (agents.length === 0) {
      toast('Select at least one agent', 'warning');
      return null;
    }

    var finalPrompt = preset && PRESET_PROMPTS[preset]
      ? PRESET_PROMPTS[preset] + '\n\nExtra: ' + (prompt || 'Make it great.')
      : (prompt || 'Create something interesting.');

    var isCollab = collabMode === 'collab' && agents.length > 1;

    var task = {
      id: uid(),
      prompt: finalPrompt,
      preset: preset || 'custom',
      agents: agents.map(function(a) { return a.id; }),
      agentNames: agents.map(function(a) { return a.name; }),
      isCollab: isCollab,
      progress: 0,
      agentProgress: {},
      status: 'running',
      startedAt: Date.now(),
      result: null,
      html: null
    };
    agents.forEach(function(a) { task.agentProgress[a.id] = 0; });

    this.active.push(task);
    this.renderTaskList();

    if (isCollab) {
      var meeting = this.office.furniture.getCollabPoint();
      agents.forEach(function(a, i) {
        a.startCollaborating(task.id, agents[(i + 1) % agents.length], meeting);
      });
      Audio.collaborate();
      logEvent(agents.map(function(a) { return a.name.split(' ')[0]; }).join(' + ') + ' collaborating', true);
    } else {
      agents[0].startWorking(task.id);
      logEvent(agents[0].name + ' started task');
    }

    this.runTask(task, agents);
    return task;
  }

  async runTask(task, agents) {
    var duration = randomRange(8, 16);
    var start = performance.now();
    var self = this;
    function tick() {
      if (task.status !== 'running') return;
      var t = Math.min(1, (performance.now() - start) / 1000 / duration);
      task.progress = t;
      agents.forEach(function(a) { a.progress = t; task.agentProgress[a.id] = t; });
      self.renderTaskList();
      self.office.updateSelectionIfNeeded();
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    try {
      var result = task.isCollab
        ? await generateCollaborative(agents, task.prompt)
        : await generateForAgent(agents[0], task.prompt);

      var remaining = duration * 1000 - (performance.now() - start);
      if (remaining > 0) await new Promise(function(r) { setTimeout(r, remaining); });

      task.status = 'done';
      task.result = result.text;
      task.html = result.html || extractHTML(result.text);

      var reward = 40 + agents.length * 25 + (task.isCollab ? 30 : 0);
      this.office.addMoney(reward);
      this.office.addReputation(agents.length + (task.isCollab ? 2 : 1));

      agents.forEach(function(a) {
        a.goIdle();
        a.say(pick(['Done!', 'Shipped.', 'Not bad.', 'Next?']), 2.5);
      });

      Audio.success();
      logEvent('Task complete! +' + reward + ' credits', true);
      toast('Task complete · +' + reward + ' 💰', 'success');
      this.showResult(task);
      Storage.addCompletedTask({ id: task.id, prompt: task.prompt.slice(0, 120), agents: task.agentNames, isCollab: task.isCollab, reward: reward, at: Date.now() });
      this.active = this.active.filter(function(t) { return t.id !== task.id; });
      this.renderTaskList();
    } catch (err) {
      console.error(err);
      task.status = 'failed';
      agents.forEach(function(a) { a.goIdle(); });
      toast('Task failed', 'error');
      this.active = this.active.filter(function(t) { return t.id !== task.id; });
      this.renderTaskList();
    }
  }

  showResult(task) {
    var modal = document.getElementById('modal-result');
    var body = document.getElementById('result-content');
    var title = document.getElementById('result-title');
    if (!modal || !body) return;
    title.textContent = task.agentNames.join(' + ') + ' — Result';
    body.innerHTML = '<pre style="white-space:pre-wrap;font-size:12px;max-height:300px;overflow:auto">' + String(task.result || '').replace(/&/g,'&').replace(/</g,'<') + '</pre>';
    if (task.html) {
      body.innerHTML = '<iframe sandbox="allow-scripts" style="width:100%;height:280px;border:1px solid #333;border-radius:8px;background:#fff"></iframe>' + body.innerHTML;
      var iframe = body.querySelector('iframe');
      if (iframe) iframe.srcdoc = task.html;
    }
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.querySelectorAll('.modal').forEach(function(m) { m.classList.add('hidden'); });
    modal.classList.remove('hidden');
  }

  renderTaskList() {
    var el = document.getElementById('task-list');
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
