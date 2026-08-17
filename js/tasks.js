// Task system with multi-agent collaboration support

import { uid, pick, randomRange } from './utils.js';
import { generateForAgent, generateCollaborative, extractHTML } from './llm.js';
import { Audio } from './audio.js';
import { logEvent, toast } from './utils.js';
import { Storage } from './storage.js';

const PRESET_PROMPTS = {
  minigame: 'Create a fun, self-contained playable mini-game in a single HTML file. Keep it simple, colorful, and addictive. Include score or a clear goal.',
  landing: 'Design a beautiful, modern single-page landing page for a fictional AI product. Include hero, features, and a CTA. Use pure HTML/CSS.',
  tool: 'Build a small useful browser utility (e.g. color picker, unit converter, pomodoro, markdown preview). Self-contained HTML.',
  story: 'Write a short interactive branching story or text adventure that runs in the browser. HTML + JS.',
  dashboard: 'Create a stylish dashboard widget or mini analytics panel with fake but pretty data visualizations. Pure HTML/CSS/JS.',
  gameart: 'Produce an art direction + lore package for a small game: color palette, mood, character concepts, and a short lore blurb. Also sketch a simple visual HTML mock if possible.'
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
      ? `${PRESET_PROMPTS[preset]}\n\nExtra instructions: ${prompt || 'Make it great.'}`
      : (prompt || 'Create something interesting and useful.');

    const isCollab = collabMode === 'collab' && agents.length > 1;

    const task = {
      id: uid(),
      prompt: finalPrompt,
      preset: preset || 'custom',
      agents: agents.map(a => a.id),
      agentNames: agents.map(a => a.name),
      isCollab,
      progress: 0,
      agentProgress: Object.fromEntries(agents.map(a => [a.id, 0])),
      status: 'running',
      startedAt: Date.now(),
      result: null,
      html: null
    };

    this.active.push(task);
    this.renderTaskList();

    // Kick off agents
    if (isCollab) {
      const meeting = this.office.furniture.getCollabPoint();
      agents.forEach((a, i) => {
        const partner = agents[(i + 1) % agents.length];
        a.startCollaborating(task.id, partner, meeting);
      });
      Audio.collaborate();
      logEvent(`${agents.map(a => a.name.split(' ')[0]).join(' + ')} started collaborating`, true);
    } else {
      const lead = agents[0];
      lead.startWorking(task.id);
      logEvent(`${lead.name} started task: ${finalPrompt.slice(0, 50)}...`);
    }

    // Simulate progress + actual generation
    this.runTask(task, agents);

    return task;
  }

  async runTask(task, agents) {
    const duration = randomRange(8, 16); // seconds of "work"
    const start = performance.now();
    const tick = () => {
      if (task.status !== 'running') return;
      const elapsed = (performance.now() - start) / 1000;
      const t = Math.min(1, elapsed / duration);
      task.progress = t;

      // Distribute progress
      agents.forEach((a, i) => {
        // Stagger slightly
        const offset = i * 0.08;
        const ap = Math.max(0, Math.min(1, (t - offset) / (1 - offset * agents.length * 0.3)));
        task.agentProgress[a.id] = ap;
        a.progress = ap;
      });

      this.renderTaskList();
      this.office.updateSelectionIfNeeded();

      if (t < 1) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);

    // Actual LLM work (runs in parallel with the visual progress)
    try {
      let result;
      if (task.isCollab) {
        result = await generateCollaborative(agents, task.prompt);
      } else {
        result = await generateForAgent(agents[0], task.prompt);
        result.parts = [{ agent: agents[0], text: result.text, source: result.source }];
      }

      // Wait until visual progress finishes
      const remaining = duration * 1000 - (performance.now() - start);
      if (remaining > 0) await new Promise(r => setTimeout(r, remaining));

      task.status = 'done';
      task.result = result.text;
      task.html = result.html || extractHTML(result.text);
      task.finishedAt = Date.now();
      task.source = result.source;

      // Reward
      const reward = 40 + agents.length * 25 + (task.isCollab ? 30 : 0);
      this.office.addMoney(reward);
      this.office.addReputation(agents.length + (task.isCollab ? 2 : 1));

      // Free agents
      agents.forEach(a => {
        a.goIdle();
        a.say(pick(['Done!', 'Shipped.', 'Not bad.', 'Next?', 'That was fun.']), 2.5);
      });

      Audio.success();
      logEvent(`Task complete! +${reward} credits`, true);
      toast(`Task complete · +${reward} 💰`, 'success');

      this.showResult(task);
      Storage.addCompletedTask({
        id: task.id,
        prompt: task.prompt.slice(0, 120),
        agents: task.agentNames,
        isCollab: task.isCollab,
        reward,
        at: Date.now()
      });

    } catch (err) {
      console.error(err);
      task.status = 'failed';
      agents.forEach(a => a.goIdle());
      toast('Task failed — try again', 'error');
      Audio.error();
    }

    this.active = this.active.filter(t => t.id !== task.id);
    this.renderTaskList();
  }

  showResult(task) {
    const modal = document.getElementById('modal-result');
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('result-title').textContent = task.isCollab
      ? 'Collaborative Task Complete'
      : 'Task Complete';

    const agentsEl = document.getElementById('result-agents');
    agentsEl.innerHTML = task.agentNames.map(n =>
      `<div class="result-agent-chip">${n}</div>`
    ).join('');

    document.getElementById('result-content').textContent = task.result || '(no output)';

    const preview = document.getElementById('result-preview');
    const iframe = document.getElementById('result-iframe');
    if (task.html) {
      preview.classList.remove('hidden');
      iframe.srcdoc = task.html;
    } else {
      preview.classList.add('hidden');
      iframe.srcdoc = '';
    }

    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
  }

  renderTaskList() {
    const el = document.getElementById('task-list');
    if (!el) return;
    if (this.active.length === 0) {
      el.innerHTML = '<div class="empty-state" style="padding:8px;font-size:12px;">No active tasks</div>';
      return;
    }
    el.innerHTML = this.active.map(t => `
      <div class="task-card">
        <div class="task-title">${t.isCollab ? '🤝 ' : ''}${t.prompt.slice(0, 42)}${t.prompt.length > 42 ? '…' : ''}</div>
        <div class="task-agents">${t.agentNames.map(n => n.split(' ')[0]).join(' · ')}</div>
        <div class="task-progress"><div class="task-progress-bar" style="width:${Math.round(t.progress * 100)}%"></div></div>
      </div>
    `).join('');
  }
}
