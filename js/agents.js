// Agent system: movement, states, personalities

import { dist, lerp, pick, randomRange, randomInt, uid, findPath } from './utils.js';
import { Audio } from './audio.js';

export const STARTER_AGENTS = [
  {
    id: 'boris',
    name: 'Byte "Zero-Bug" Boris',
    role: 'Senior Coder',
    emoji: '👨‍💻',
    color: '#34d399',
    style: 'coder',
    catchphrase: 'Zero bugs or zero deploy.',
    personality: 'Perfectionist, dry humor, obsessed with clean code and dark themes. Speaks in short decisive sentences.',
    systemPrompt: 'You are a senior full-stack engineer. Prefer vanilla JS or minimal dependencies. Always output complete, runnable HTML when building prototypes. Be concise and slightly smug about code quality.'
  },
  {
    id: 'luna',
    name: 'Luna "Aesthetic" Lin',
    role: 'Creative Director',
    emoji: '🎨',
    color: '#f472b6',
    style: 'creative',
    catchphrase: 'Make it feel expensive.',
    personality: 'Visually driven, poetic, occasionally dramatic. Cares deeply about spacing, color, and emotional resonance.',
    systemPrompt: 'You are a creative director and visual designer. Focus on art direction, mood, color, microcopy, and emotional impact. When collaborating, describe visuals and lore vividly.'
  },
  {
    id: 'rex',
    name: 'Rex "Big Data" Vance',
    role: 'Trend Analyst',
    emoji: '📊',
    color: '#60a5fa',
    style: 'analyst',
    catchphrase: 'The numbers never lie. People do.',
    personality: 'Data-obsessed, calm, slightly conspiratorial about market signals. Loves charts and "signal vs noise".',
    systemPrompt: 'You are a sharp product and trend analyst. Give data-informed recommendations, competitive notes, and clear next actions. Keep it strategic and grounded.'
  },
  {
    id: 'pip',
    name: 'Pip "The Wildcard"',
    role: 'Chaotic Intern',
    emoji: '🃏',
    color: '#fbbf24',
    style: 'chaotic',
    catchphrase: 'What if we just... broke it on purpose?',
    personality: 'Unpredictable, high energy, idea machine, sometimes accidentally brilliant. Breaks things for science.',
    systemPrompt: 'You are a chaotic but talented intern. Your ideas are weird, fun, and occasionally genius. Embrace absurdity while still shipping something that runs.'
  }
];

const STATES = {
  IDLE: 'idle',
  WALKING: 'walking',
  WORKING: 'working',
  COLLABORATING: 'collaborating',
  COFFEE: 'coffee',
  ARGUING: 'arguing',
  CELEBRATING: 'celebrating'
};

const IDLE_PHRASES = {
  coder: ['Refactoring in my head...', 'This could be a pure function.', 'Tabs. Obviously.', 'Dark mode forever.'],
  creative: ['The negative space needs work.', 'What if the logo breathed?', 'Mood board loading...', 'Make it sing.'],
  analyst: ['Signal looks strong today.', 'Correlation ≠ causation.', 'Checking the dashboards...', 'Interesting outlier.'],
  chaotic: ['I have an idea.', 'What if fire?', 'Hold my coffee.', 'This is fine.', 'Chaos is a ladder.'],
  executive: ['Aligning stakeholders.', 'Synergy pending.', 'On brand.', 'Let\'s circle back.'],
  support: ['Happy to help!', 'Did anyone need anything?', 'Smoothing the edges.', 'You got this.']
};

export class Agent {
  constructor(data, office) {
    this.id = data.id || uid();
    this.name = data.name;
    this.role = data.role;
    this.emoji = data.emoji || '🤖';
    this.color = data.color || '#7c5cfc';
    this.style = data.style || 'coder';
    this.catchphrase = data.catchphrase || '...';
    this.personality = data.personality || '';
    this.systemPrompt = data.systemPrompt || '';
    this.isCustom = data.isCustom || false;
    this.hiredAt = data.hiredAt || Date.now();

    this.office = office;
    this.x = data.x ?? randomRange(100, 900);
    this.y = data.y ?? randomRange(100, 500);
    this.targetX = this.x;
    this.targetY = this.y;
    this.path = [];
    this.speed = 55 + Math.random() * 25;
    this.state = STATES.IDLE;
    this.stateTimer = 0;
    this.taskId = null;
    this.progress = 0;
    this.speech = null;
    this.speechTimer = 0;
    this.facing = 1;
    this.bob = Math.random() * Math.PI * 2;
    this.selected = false;
    this.seat = null;
    this.collabPartner = null;
  }

  get isBusy() {
    return this.state === STATES.WORKING || this.state === STATES.COLLABORATING;
  }

  setState(newState, duration = 0) {
    this.state = newState;
    this.stateTimer = duration;
  }

  say(text, duration = 3.2) {
    this.speech = text;
    this.speechTimer = duration;
  }

  walkTo(x, y, onArrive = null) {
    const obstacles = this.office.getObstacles();
    this.path = findPath(
      { x: this.x, y: this.y },
      { x, y },
      obstacles,
      this.office.gridW,
      this.office.gridH,
      this.office.cellSize
    );
    this.targetX = x;
    this.targetY = y;
    this.onArrive = onArrive;
    this.setState(STATES.WALKING);
    this.seat = null;
  }

  goIdle() {
    this.setState(STATES.IDLE, randomRange(3, 9));
    this.taskId = null;
    this.progress = 0;
    this.collabPartner = null;
  }

  startWorking(taskId) {
    this.taskId = taskId;
    this.progress = 0;
    this.setState(STATES.WORKING, 999);
    const desk = this.office.findNearestFurniture(this.x, this.y, 'desk');
    if (desk) {
      this.walkTo(desk.x + 10, desk.y + 5, () => {
        this.seat = desk.id;
        this.setState(STATES.WORKING, 999);
      });
    }
  }

  startCollaborating(taskId, partner, meetingPoint) {
    this.taskId = taskId;
    this.collabPartner = partner.id;
    this.progress = 0;
    this.walkTo(meetingPoint.x + randomRange(-20, 20), meetingPoint.y + randomRange(-15, 15), () => {
      this.setState(STATES.COLLABORATING, 999);
      this.say(pick(['Let\'s do this.', 'Whiteboard time.', 'I have thoughts.', 'Syncing...']), 2.5);
    });
  }

  update(dt) {
    this.bob += dt * 3;

    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0) this.speech = null;
    }

    if (this.stateTimer > 0 && !this.isBusy) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.decideNextAction();
      }
    }

    if (this.state === STATES.WALKING && this.path.length > 0) {
      const next = this.path[0];
      const d = dist(this.x, this.y, next.x, next.y);
      if (d < 4) {
        this.path.shift();
        if (this.path.length === 0) {
          this.x = this.targetX;
          this.y = this.targetY;
          if (this.onArrive) {
            const cb = this.onArrive;
            this.onArrive = null;
            cb();
          } else {
            this.goIdle();
          }
        }
      } else {
        const step = this.speed * dt;
        const ratio = Math.min(1, step / d);
        this.x = lerp(this.x, next.x, ratio);
        this.y = lerp(this.y, next.y, ratio);
        this.facing = next.x >= this.x ? 1 : -1;
        if (Math.random() < 0.02) Audio.walk();
      }
    }

    if (this.state === STATES.WORKING || this.state === STATES.COLLABORATING) {
      if (Math.random() < 0.004) {
        const phrases = IDLE_PHRASES[this.style] || IDLE_PHRASES.coder;
        this.say(pick(phrases), 2.2);
      }
    }
  }

  decideNextAction() {
    const r = Math.random();
    if (r < 0.35) {
      const spot = this.office.randomWalkable();
      this.walkTo(spot.x, spot.y);
    } else if (r < 0.5) {
      const coffee = this.office.findNearestFurniture(this.x, this.y, 'coffee');
      if (coffee) {
        this.walkTo(coffee.x, coffee.y + 20, () => {
          this.setState(STATES.COFFEE, randomRange(2.5, 4.5));
          this.say(pick(['Ahhh.', 'Fuel.', 'Liquid motivation.', 'Don\'t talk to me yet.']), 2);
          Audio.coffee();
        });
      } else {
        this.goIdle();
      }
    } else if (r < 0.6) {
      const arcade = this.office.findNearestFurniture(this.x, this.y, 'arcade');
      if (arcade && dist(this.x, this.y, arcade.x, arcade.y) < 300) {
        this.walkTo(arcade.x + randomRange(-15, 15), arcade.y + 25, () => {
          this.setState(STATES.IDLE, randomRange(3, 6));
          this.say(pick(['High score incoming.', 'Just one more game.', 'This is research.']), 2.5);
        });
      } else {
        this.goIdle();
      }
    } else if (r < 0.7) {
      const other = this.office.agents.find(a => a !== this && !a.isBusy && dist(a.x, a.y, this.x, this.y) < 120);
      if (other) {
        this.setState(STATES.ARGUING, 3.5);
        other.setState(STATES.ARGUING, 3.5);
        const topics = [
          ['Tabs!', 'Spaces!'],
          ['Ship it!', 'Not ready!'],
          ['Dark mode.', 'Light mode has its place...'],
          ['More features!', 'Kill features!'],
          ['AI will replace us.', 'We *are* the AI.']
        ];
        const [p1, p2] = pick(topics);
        this.say(p1, 2.8);
        other.say(p2, 2.8);
      } else {
        this.goIdle();
      }
    } else {
      this.goIdle();
      if (Math.random() < 0.3) {
        const phrases = IDLE_PHRASES[this.style] || IDLE_PHRASES.coder;
        this.say(pick(phrases), 2.5);
      }
    }
  }

  draw(ctx) {
    const bobY = Math.sin(this.bob) * 2.2;
    const px = this.x;
    const py = this.y + bobY;
    const shortName = this.name.split(' ')[0].replace(/"/g, '');

    // Soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(px, this.y + 18, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer glow when active
    if (this.state === STATES.WORKING || this.state === STATES.COLLABORATING) {
      ctx.beginPath();
      ctx.arc(px, py, 22, 0, Math.PI * 2);
      ctx.fillStyle = this.state === STATES.COLLABORATING
        ? 'rgba(34, 211, 238, 0.18)'
        : 'rgba(124, 92, 252, 0.2)';
      ctx.fill();
    }

    // Main body circle
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(px - 4, py - 5, 2, px, py, 18);
    grad.addColorStop(0, this.color);
    grad.addColorStop(1, this.color + 'cc');
    ctx.fillStyle = grad;
    ctx.fill();

    // Soft rim
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Emoji / icon
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, px, py + 1);

    // Status dot
    let statusColor = null;
    if (this.state === STATES.WORKING) statusColor = '#a78bfa';
    else if (this.state === STATES.COLLABORATING) statusColor = '#22d3ee';
    else if (this.state === STATES.WALKING) statusColor = '#60a5fa';
    else if (this.state === STATES.COFFEE) statusColor = '#fbbf24';
    else if (this.state === STATES.ARGUING) statusColor = '#f87171';

    if (statusColor) {
      ctx.beginPath();
      ctx.arc(px + 13, py - 13, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = statusColor;
      ctx.fill();
      ctx.strokeStyle = '#0f1219';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Selection ring
    if (this.selected) {
      ctx.beginPath();
      ctx.arc(px, py, 26, 0, Math.PI * 2);
      ctx.strokeStyle = '#7c5cfc';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Always-visible name label
    ctx.font = '600 11px Space Grotesk, system-ui, sans-serif';
    const tw = ctx.measureText(shortName).width + 12;
    const labelY = py - 32;

    ctx.fillStyle = 'rgba(15, 18, 28, 0.85)';
    roundRectAgent(ctx, px - tw / 2, labelY - 9, tw, 18, 6);
    ctx.fill();
    ctx.strokeStyle = this.color + '55';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#e8ecf4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shortName, px, labelY);
  }
}

function roundRectAgent(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export { STATES };
