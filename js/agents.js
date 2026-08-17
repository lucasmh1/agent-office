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
    this.seat = null; // furniture id if sitting
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
    // Prefer a desk
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

    // Speech timer
    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0) this.speech = null;
    }

    // State timer for non-busy states
    if (this.stateTimer > 0 && !this.isBusy) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.decideNextAction();
      }
    }

    // Movement
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

    // Working progress is driven by task system
    if (this.state === STATES.WORKING || this.state === STATES.COLLABORATING) {
      // Occasional mutter
      if (Math.random() < 0.004) {
        const phrases = IDLE_PHRASES[this.style] || IDLE_PHRASES.coder;
        this.say(pick(phrases), 2.2);
      }
    }
  }

  decideNextAction() {
    const r = Math.random();
    if (r < 0.35) {
      // Wander
      const spot = this.office.randomWalkable();
      this.walkTo(spot.x, spot.y);
    } else if (r < 0.5) {
      // Coffee
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
      // Arcade attraction
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
      // Argue with nearby agent (fun)
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
    const bobY = Math.sin(this.bob) * 2.5;
    const px = this.x;
    const py = this.y + bobY;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(px, this.y + 14, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body circle
    ctx.beginPath();
    ctx.arc(px, py, 16, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Emoji face
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, px, py + 1);

    // Status indicator
    if (this.state === STATES.WORKING) {
      ctx.fillStyle = '#7c5cfc';
      ctx.beginPath();
      ctx.arc(px + 12, py - 12, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.state === STATES.COLLABORATING) {
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(px + 12, py - 12, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Selection ring
    if (this.selected) {
      ctx.strokeStyle = '#7c5cfc';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(px, py, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Name tag on hover/select
    if (this.selected || this.speech) {
      ctx.font = '600 11px Space Grotesk, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      const tw = ctx.measureText(this.name.split(' ')[0]).width + 10;
      ctx.fillRect(px - tw / 2, py - 34, tw, 16);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(this.name.split(' ')[0], px, py - 23);
    }
  }
}

export { STATES };
