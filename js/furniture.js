// Dynamic furniture system

import { uid, dist } from './utils.js';

export const FURNITURE_TYPES = {
  desk: {
    id: 'desk',
    name: 'Desk',
    emoji: '🖥️',
    w: 70,
    h: 40,
    color: '#2d3548',
    seats: true,
    attract: 0.3
  },
  chair: {
    id: 'chair',
    name: 'Chair',
    emoji: '🪑',
    w: 28,
    h: 28,
    color: '#3a4558',
    seats: true,
    attract: 0.1
  },
  coffee: {
    id: 'coffee',
    name: 'Coffee Machine',
    emoji: '☕',
    w: 36,
    h: 42,
    color: '#4a3728',
    seats: false,
    attract: 0.6
  },
  arcade: {
    id: 'arcade',
    name: 'Arcade Cabinet',
    emoji: '🕹️',
    w: 40,
    h: 55,
    color: '#1a1a3e',
    seats: false,
    attract: 0.8
  },
  plant: {
    id: 'plant',
    name: 'Plant',
    emoji: '🪴',
    w: 30,
    h: 36,
    color: '#1e3a2f',
    seats: false,
    attract: 0
  },
  whiteboard: {
    id: 'whiteboard',
    name: 'Whiteboard',
    emoji: '📋',
    w: 80,
    h: 50,
    color: '#e8ecf4',
    seats: false,
    attract: 0.4,
    collabSpot: true
  },
  beanbag: {
    id: 'beanbag',
    name: 'Bean Bag',
    emoji: '🛋️',
    w: 44,
    h: 36,
    color: '#5b21b6',
    seats: true,
    attract: 0.5
  },
  neon: {
    id: 'neon',
    name: 'Neon Sign',
    emoji: '✨',
    w: 60,
    h: 28,
    color: '#7c5cfc',
    seats: false,
    attract: 0
  },
  server: {
    id: 'server',
    name: 'Server Rack',
    emoji: '🗄️',
    w: 36,
    h: 60,
    color: '#1e293b',
    seats: false,
    attract: 0.2
  },
  executive: {
    id: 'executive',
    name: 'Executive Desk',
    emoji: '👔',
    w: 90,
    h: 50,
    color: '#3f2a1a',
    seats: true,
    attract: 0.4
  }
};

export function createFurniture(typeId, x, y) {
  const type = FURNITURE_TYPES[typeId];
  if (!type) return null;
  return {
    id: uid(),
    type: typeId,
    x,
    y,
    ...type
  };
}

export const DEFAULT_FURNITURE = [
  // Recharge Kitchen
  createFurniture('coffee', 120, 120),
  createFurniture('plant', 220, 90),

  // Strategy & Whiteboard
  createFurniture('whiteboard', 500, 100),
  createFurniture('neon', 420, 80),

  // Cloud Nodes
  createFurniture('server', 780, 110),
  createFurniture('server', 860, 110),
  createFurniture('arcade', 980, 120),

  // Dev & Design Pod (main work area)
  createFurniture('desk', 120, 320),
  createFurniture('desk', 250, 320),
  createFurniture('desk', 380, 320),
  createFurniture('desk', 120, 420),
  createFurniture('desk', 250, 420),
  createFurniture('chair', 120, 355),
  createFurniture('chair', 250, 355),
  createFurniture('chair', 380, 355),

  // Growth & Trend Lab
  createFurniture('desk', 560, 320),
  createFurniture('desk', 700, 320),
  createFurniture('desk', 560, 420),
  createFurniture('chair', 560, 355),
  createFurniture('chair', 700, 355),

  // Zen Lounge
  createFurniture('beanbag', 930, 340),
  createFurniture('beanbag', 980, 420),
  createFurniture('plant', 900, 480)
];

export class FurnitureManager {
  constructor(office) {
    this.office = office;
    this.items = [];
    this.mode = false;
    this.selectedType = null;
    this.dragging = null;
  }

  load(saved) {
    // Force nicer zone layout (v2)
    const layoutVersion = localStorage.getItem('ao_layout_v');
    if (layoutVersion !== '2' || !saved || !Array.isArray(saved) || !saved.length) {
      this.items = DEFAULT_FURNITURE.map(f => ({ ...f }));
      localStorage.setItem('ao_layout_v', '2');
    } else {
      this.items = saved.map(s => ({
        ...FURNITURE_TYPES[s.type],
        ...s
      }));
    }
  }

  getSerializable() {
    return this.items.map(i => ({
      id: i.id,
      type: i.type,
      x: i.x,
      y: i.y
    }));
  }

  add(typeId, x, y) {
    const f = createFurniture(typeId, x, y);
    if (f) {
      this.items.push(f);
      return f;
    }
    return null;
  }

  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
  }

  findNearest(x, y, typeFilter = null) {
    let best = null;
    let bestD = Infinity;
    for (const item of this.items) {
      if (typeFilter && item.type !== typeFilter) continue;
      const d = dist(x, y, item.x, item.y);
      if (d < bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  }

  getCollabPoint() {
    const board = this.items.find(i => i.collabSpot);
    if (board) return { x: board.x, y: board.y + 40 };
    return { x: 550, y: 350 };
  }

  getObstacles() {
    return this.items
      .filter(i => !i.seats)
      .map(i => ({ x: i.x, y: i.y, r: Math.max(i.w, i.h) * 0.35 }));
  }

  draw(ctx) {
    for (const item of this.items) {
      this.drawItem(ctx, item);
    }
  }

  drawItem(ctx, item) {
    const { x, y, w, h, color, emoji, type } = item;

    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;

    if (type === 'desk' || type === 'executive') {
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      roundRect(ctx, x - 18, y - h / 2 - 22, 36, 24, 3);
      ctx.fill();
      ctx.fillStyle = '#22d3ee';
      ctx.globalAlpha = 0.3;
      roundRect(ctx, x - 15, y - h / 2 - 19, 30, 18, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (type === 'whiteboard') {
      ctx.fillStyle = '#f1f5f9';
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 4);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.stroke();
      ctx.strokeStyle = '#7c5cfc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 25, y - 10);
      ctx.lineTo(x + 10, y - 5);
      ctx.lineTo(x - 5, y + 12);
      ctx.stroke();
      ctx.strokeStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 15);
      ctx.quadraticCurveTo(x + 25, y, x + 15, y + 10);
      ctx.stroke();
    } else if (type === 'arcade') {
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 4);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      roundRect(ctx, x - 14, y - h / 2 + 8, 28, 22, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(124,92,252,0.4)';
      ctx.beginPath();
      ctx.arc(x, y - 5, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'neon') {
      ctx.shadowColor = '#7c5cfc';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#7c5cfc';
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Space Grotesk';
      ctx.textAlign = 'center';
      ctx.fillText('SHIP IT', x, y + 4);
    } else if (type === 'coffee') {
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 4);
      ctx.fill();
      ctx.fillStyle = '#1a120b';
      ctx.fillRect(x - 10, y - 8, 20, 14);
    } else if (type === 'beanbag') {
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 5);
      ctx.fill();
      ctx.stroke();
    }

    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(emoji, x, y + (type === 'desk' || type === 'executive' ? 4 : 0));
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
