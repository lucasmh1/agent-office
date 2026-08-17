// Utility helpers

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function formatMoney(n) {
  return n.toLocaleString('en-US');
}

export function now() {
  return performance.now();
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Simple grid pathfinding (A* lightweight)
export function findPath(start, end, obstacles, gridW, gridH, cellSize) {
  const sx = Math.floor(start.x / cellSize);
  const sy = Math.floor(start.y / cellSize);
  const ex = Math.floor(end.x / cellSize);
  const ey = Math.floor(end.y / cellSize);

  if (sx === ex && sy === ey) return [{ x: end.x, y: end.y }];

  const key = (x, y) => `${x},${y}`;
  const open = [{ x: sx, y: sy, g: 0, h: Math.abs(ex - sx) + Math.abs(ey - sy), f: 0, parent: null }];
  open[0].f = open[0].g + open[0].h;
  const closed = new Set();
  const cameFrom = new Map();

  const dirs = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const ck = key(current.x, current.y);
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (current.x === ex && current.y === ey) {
      const path = [];
      let node = current;
      while (node) {
        path.push({ x: node.x * cellSize + cellSize / 2, y: node.y * cellSize + cellSize / 2 });
        node = node.parent;
      }
      path.reverse();
      // Snap final to exact target
      if (path.length) path[path.length - 1] = { x: end.x, y: end.y };
      return path;
    }

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      // Check obstacle (simple)
      const worldX = nx * cellSize + cellSize / 2;
      const worldY = ny * cellSize + cellSize / 2;
      if (obstacles.some(o => dist(worldX, worldY, o.x, o.y) < (o.r || 20))) continue;

      const g = current.g + (dx !== 0 && dy !== 0 ? 1.4 : 1);
      const h = Math.abs(ex - nx) + Math.abs(ey - ny);
      const existing = open.find(n => n.x === nx && n.y === ny);
      if (!existing || g < existing.g) {
        const node = { x: nx, y: ny, g, h, f: g + h, parent: current };
        if (existing) {
          Object.assign(existing, node);
        } else {
          open.push(node);
        }
      }
    }
  }
  // Fallback: direct line
  return [{ x: end.x, y: end.y }];
}

export function toast(message, type = 'info', duration = 3200) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

export function logEvent(message, important = false) {
  const log = document.getElementById('event-log');
  if (!log) return;
  const entry = document.createElement('div');
  entry.className = `log-entry${important ? ' important' : ''}`;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  entry.textContent = `[${time}] ${message}`;
  log.prepend(entry);
  while (log.children.length > 40) log.lastChild.remove();
}
