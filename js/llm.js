// Dual LLM system: Gemini API + high-quality offline fallback

import { Storage } from './storage.js';
import { pick, randomInt } from './utils.js';

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest'
];

// Offline creative response templates keyed by specialty / style
const OFFLINE_TEMPLATES = {
  coder: [
    `Built a proper playable mini-game. Asteroids-style for the hackathon energy.\n\n\`\`\`html\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <title>{{title}}</title>\n  <style>\n    * { box-sizing: border-box; margin: 0; }\n    body { background: #0a0e17; color: #e2e8f0; font-family: system-ui; display: grid; place-items: center; min-height: 100vh; }\n    .wrap { text-align: center; }\n    canvas { background: #0f172a; border: 2px solid #7c5cfc55; border-radius: 10px; display: block; margin: 12px auto; box-shadow: 0 0 40px #7c5cfc33; }\n    .hud { display: flex; justify-content: space-between; width: 480px; margin: 0 auto 8px; font-size: 14px; font-weight: 600; }\n    .hint { opacity: 0.55; font-size: 12px; margin-top: 8px; }\n  </style>\n</head>\n<body>\n  <div class=\"wrap\">\n    <div class=\"hud\"><span>SCORE: <b id=\"score\">0</b></span><span>LIVES: <b id=\"lives\">3</b></span></div>\n    <canvas id=\"c\" width=\"480\" height=\"360\"></canvas>\n    <div class=\"hint\">← → rotate · Space thrust · Z / Click shoot · Survive the swarm</div>\n  </div>\n  <script>\n    const c = document.getElementById('c'), ctx = c.getContext('2d');\n    let score = 0, lives = 3, ship = { x: 240, y: 180, a: 0, vx: 0, vy: 0 }, bullets = [], rocks = [], keys = {}, over = false;\n    function spawnRock(s = 2) {\n      const edge = Math.random() < 0.5;\n      rocks.push({\n        x: edge ? (Math.random() < 0.5 ? 0 : 480) : Math.random() * 480,\n        y: edge ? Math.random() * 360 : (Math.random() < 0.5 ? 0 : 360),\n        vx: (Math.random() - 0.5) * 2.2, vy: (Math.random() - 0.5) * 2.2,\n        r: 12 + s * 10, s\n      });\n    }\n    for (let i = 0; i < 5; i++) spawnRock(2);\n    window.onkeydown = e => keys[e.key] = true;\n    window.onkeyup = e => keys[e.key] = false;\n    c.onclick = () => shoot();\n    function shoot() {\n      if (over) return;\n      bullets.push({ x: ship.x, y: ship.y, vx: Math.cos(ship.a) * 7, vy: Math.sin(ship.a) * 7, life: 50 });\n    }\n    function loop() {\n      if (!over) {\n        if (keys['ArrowLeft'] || keys['a']) ship.a -= 0.08;\n        if (keys['ArrowRight'] || keys['d']) ship.a += 0.08;\n        if (keys[' '] || keys['ArrowUp'] || keys['w']) {\n          ship.vx += Math.cos(ship.a) * 0.18;\n          ship.vy += Math.sin(ship.a) * 0.18;\n        }\n        if (keys['z'] || keys['Z']) { if (Math.random() < 0.35) shoot(); }\n        ship.vx *= 0.99; ship.vy *= 0.99;\n        ship.x = (ship.x + ship.vx + 480) % 480;\n        ship.y = (ship.y + ship.vy + 360) % 360;\n      }\n      ctx.fillStyle = '#0f172a';\n      ctx.fillRect(0, 0, 480, 360);\n      ctx.fillStyle = '#334155';\n      for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % 480, (i * 53) % 360, 1, 1);\n      ctx.save();\n      ctx.translate(ship.x, ship.y);\n      ctx.rotate(ship.a);\n      ctx.strokeStyle = '#a78bfa';\n      ctx.lineWidth = 2;\n      ctx.beginPath();\n      ctx.moveTo(14, 0); ctx.lineTo(-10, 9); ctx.lineTo(-6, 0); ctx.lineTo(-10, -9);\n      ctx.closePath(); ctx.stroke();\n      ctx.restore();\n      bullets = bullets.filter(b => {\n        b.x += b.vx; b.y += b.vy; b.life--;\n        ctx.fillStyle = '#22d3ee';\n        ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill();\n        return b.life > 0 && b.x > 0 && b.x < 480 && b.y > 0 && b.y < 360;\n      });\n      rocks.forEach(r => {\n        r.x = (r.x + r.vx + 480) % 480;\n        r.y = (r.y + r.vy + 360) % 360;\n        ctx.strokeStyle = '#f472b6';\n        ctx.lineWidth = 1.5;\n        ctx.beginPath();\n        for (let i = 0; i < 7; i++) {\n          const ang = (i / 7) * Math.PI * 2;\n          const rad = r.r * (0.75 + Math.sin(i * 3 + r.x) * 0.2);\n          i === 0 ? ctx.moveTo(r.x + Math.cos(ang) * rad, r.y + Math.sin(ang) * rad)\n                  : ctx.lineTo(r.x + Math.cos(ang) * rad, r.y + Math.sin(ang) * rad);\n        }\n        ctx.closePath(); ctx.stroke();\n      });\n      for (let i = rocks.length - 1; i >= 0; i--) {\n        const r = rocks[i];\n        const dx = r.x - ship.x, dy = r.y - ship.y;\n        if (Math.hypot(dx, dy) < r.r + 8) {\n          rocks.splice(i, 1);\n          lives--;\n          document.getElementById('lives').textContent = lives;\n          ship.vx = ship.vy = 0;\n          if (lives <= 0) over = true;\n          if (r.s > 0) { spawnRock(r.s - 1); spawnRock(r.s - 1); }\n          continue;\n        }\n        for (let j = bullets.length - 1; j >= 0; j--) {\n          if (Math.hypot(r.x - bullets[j].x, r.y - bullets[j].y) < r.r) {\n            bullets.splice(j, 1);\n            rocks.splice(i, 1);\n            score += (3 - r.s) * 50;\n            document.getElementById('score').textContent = score;\n            if (r.s > 0) { spawnRock(r.s - 1); spawnRock(r.s - 1); }\n            break;\n          }\n        }\n      }\n      if (rocks.length < 3 && !over) spawnRock(2);\n      if (over) {\n        ctx.fillStyle = 'rgba(0,0,0,0.55)';\n        ctx.fillRect(0, 0, 480, 360);\n        ctx.fillStyle = '#fff';\n        ctx.font = 'bold 28px system-ui';\n        ctx.textAlign = 'center';\n        ctx.fillText('GAME OVER', 240, 170);\n        ctx.font = '16px system-ui';\n        ctx.fillText('Score: ' + score + '  ·  Refresh to retry', 240, 205);\n      }\n      requestAnimationFrame(loop);\n    }\n    loop();\n  <\\/script>\n</body>\n</html>\n\`\`\`\n\nZero bugs. As always.`,

    `Dodge falling chaos. Clean single-file HTML5 game — matches the vibe from the Antigravity demo.\n\n\`\`\`html\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <title>{{title}}</title>\n  <style>\n    * { box-sizing: border-box; margin: 0; }\n    body { background: #0a0e17; color: #e2e8f0; font-family: system-ui; display: grid; place-items: center; min-height: 100vh; }\n    .wrap { text-align: center; }\n    canvas { background: linear-gradient(#0f172a, #1e1b4b); border: 2px solid #22d3ee44; border-radius: 12px; display: block; margin: 10px auto; box-shadow: 0 0 50px #22d3ee22; }\n    .hud { width: 360px; margin: 0 auto 6px; display: flex; justify-content: space-between; font-weight: 700; font-size: 15px; }\n    .hint { opacity: 0.5; font-size: 12px; }\n  </style>\n</head>\n<body>\n  <div class=\"wrap\">\n    <div class=\"hud\">\n      <span>SCORE: <b id=\"score\">0</b></span>\n      <span id=\"hearts\">❤️❤️❤️</span>\n    </div>\n    <canvas id=\"c\" width=\"360\" height=\"480\"></canvas>\n    <div class=\"hint\">← → or A/D to move · Dodge fire, catch the good stuff</div>\n  </div>\n  <script>\n    const c = document.getElementById('c'), ctx = c.getContext('2d');\n    let score = 0, lives = 3, px = 180, items = [], keys = {}, t = 0, over = false;\n    const good = ['☕', '⭐', '💎', '🚀'], bad = ['🔥', '💥', '👾', '⚡'];\n    window.onkeydown = e => keys[e.key] = true;\n    window.onkeyup = e => keys[e.key] = false;\n    function spawn() {\n      const isGood = Math.random() > 0.45;\n      items.push({\n        x: 20 + Math.random() * 320, y: -30,\n        vy: 2.2 + Math.random() * 2.5 + score * 0.01,\n        emoji: isGood ? good[Math.floor(Math.random()*good.length)] : bad[Math.floor(Math.random()*bad.length)],\n        good: isGood, r: 14\n      });\n    }\n    function loop() {\n      t++;\n      if (!over) {\n        if (keys['ArrowLeft'] || keys['a'] || keys['A']) px -= 5.5;\n        if (keys['ArrowRight'] || keys['d'] || keys['D']) px += 5.5;\n        px = Math.max(20, Math.min(340, px));\n        if (t % Math.max(18, 42 - Math.floor(score / 40)) === 0) spawn();\n      }\n      ctx.clearRect(0, 0, 360, 480);\n      ctx.font = '28px serif';\n      ctx.textAlign = 'center';\n      ctx.fillText('🛸', px, 450);\n      items = items.filter(it => {\n        it.y += it.vy;\n        ctx.font = '22px serif';\n        ctx.fillText(it.emoji, it.x, it.y);\n        if (it.y > 430 && Math.abs(it.x - px) < 28) {\n          if (it.good) {\n            score += 10;\n            document.getElementById('score').textContent = score;\n          } else {\n            lives--;\n            document.getElementById('hearts').textContent = '❤️'.repeat(Math.max(0, lives));\n            if (lives <= 0) over = true;\n          }\n          return false;\n        }\n        return it.y < 520;\n      });\n      if (over) {\n        ctx.fillStyle = 'rgba(0,0,0,0.6)';\n        ctx.fillRect(0, 0, 360, 480);\n        ctx.fillStyle = '#fff';\n        ctx.font = 'bold 26px system-ui';\n        ctx.textAlign = 'center';\n        ctx.fillText('GAME OVER', 180, 220);\n        ctx.font = '15px system-ui';\n        ctx.fillText('Score: ' + score, 180, 255);\n        ctx.fillText('Refresh to play again', 180, 280);\n      }\n      requestAnimationFrame(loop);\n    }\n    loop();\n  <\\/script>\n</body>\n</html>\n\`\`\`\n\nShip it.`
  ],
  creative: [
    `Art direction locked in. Here's the visual language + lore foundation:\n\n**Color Palette**\n- Primary: Deep void #0d0f14\n- Accent: Electric violet #7c5cfc\n- Highlight: Cyan pulse #22d3ee\n- Text: Soft white #e8ecf4\n\n**Mood Board Keywords**: neon nostalgia, late-night productivity, playful chaos, soft absurdity\n\n**Lore Snippet**\nIn the year 20XX the last human managers left the building. What remained were the Agents — digital beings who never sleep, rarely agree, and somehow ship beautiful things at 3 a.m.\n\n**Micro-interaction idea**: When agents high-five after a successful collab, a tiny constellation of particles forms the word "SHIPPED" for half a second.\n\nI also sketched a simple hero illustration concept (described):\nA glowing monitor surrounded by floating sticky notes, a half-empty coffee mug, and two silhouettes arguing about tabs vs spaces while a third agent quietly ships the feature in the background.`,

    `Creative package ready.\n\n**Title treatment**: Bold geometric sans, slight tracking, with a soft neon underglow.\n\n**Tone of voice**: Confident, a little irreverent, never corporate.\n\n**Key visual motif**: Circuit traces that morph into brush strokes — the perfect marriage of code and craft.\n\n**Short interactive story beat**:\n> You open the office door. The lights are already on. Someone left a sticky note on your monitor:\n> "The agents finished the prototype while you were getting coffee. Don't ask how."\n> A soft chime plays. The prototype is waiting.`
  ],
  analyst: [
    `Trend analysis complete.\n\n**Signal strength**: High\n**Relevant vectors**:\n1. Agent collaboration UX is heating up — multi-agent orchestration is the new "chat with AI".\n2. Playful productivity tools outperform pure utility by ~40% in retention.\n3. Mini-game as onboarding is still under-used in B2B SaaS.\n\n**Recommendation**: Ship the collaborative task flow first. The "agents arguing then high-fiving" loop is pure engagement gold.`,

    `I pulled the latest signals.\n\nKey insight: Users love *watching* the agents work almost as much as the final output. Progress visualization + speech bubbles = retention.\n\nCompetitive note: Most "AI office" demos are static. Ours moves. That alone is differentiation.`
  ],
  chaotic: [
    `OKAY LISTEN. I had an idea at 2:47 a.m. and I refuse to let it die.\n\nWhat if the mini-game is a *bug* that becomes the feature?\n\nAlso I may have deleted the production database. Just kidding. ...Or am I?`,

    `I rewrote the entire thing in emojis. It runs. Somehow.\n\nAnyway here's a slightly more responsible version that still feels like me:\n\nThe core loop is "embrace the bug". Every click spawns more entropy. High score is a lie. The real prize is the feeling.`
  ],
  executive: [
    `Strategic summary delivered.\n\n**Objective achieved**: Prototype ready for stakeholder review.\n**Risk level**: Low\n**Next recommended action**: Soft launch to internal users, gather qualitative feedback within 48h.\n\nThe team delivered on time. I expect full credit in the next all-hands.`,

    `Status: Green.\nDeliverable meets the acceptance criteria. I've prepared talking points for the investor call.`
  ],
  support: [
    `I cleaned up the edges and made sure the experience is approachable.\n\nAdded gentle empty states, clearer microcopy, and a small "need help?" affordance that doesn't get in the way.\n\nEverything should feel supportive rather than intimidating.`
  ]
};

const OFFLINE_COLLAB_BLEND = [
  `**Collaborative Result**\n\nThe team locked in after a brief but intense whiteboard session.\n\n{{coder_part}}\n\n---\n\n**Art & Direction notes from the creative lead:**\n{{creative_part}}\n\n---\n\nFinal notes from the room: "It actually works. Ship it before someone changes their mind."`,

  `After 47 minutes of productive arguing, the agents produced this combined package:\n\n### Technical Core\n{{coder_part}}\n\n### Creative Layer\n{{creative_part}}\n\nThey high-fived. The coffee machine made a strange noise. Everything is fine.`
];

function extractHTML(text) {
  const match = text.match(/```html\\s*([\\s\\S]*?)```/i) || text.match(/```\\s*(<!DOCTYPE[\\s\\S]*?<\\/html>)/i);
  return match ? match[1].trim() : null;
}

function buildSystemPrompt(agent) {
  return `You are ${agent.name}, ${agent.role}.\nPersonality: ${agent.personality || agent.catchphrase}\nCatchphrase: "${agent.catchphrase}"\nYour style is ${agent.style}.\nAlways respond in character. Be concise but complete. When asked to build something interactive, output a full self-contained HTML document inside a \\\`\\\`\\\`html code block.\n${agent.systemPrompt || ''}`;
}

async function callGemini(prompt, system, apiKey) {
  const models = GEMINI_MODELS;
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${system}\\n\\n---\\n\\nUser request:\\n${prompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 2048
        }
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.text();
        console.warn(`Gemini ${model} failed:`, err);
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text, source: 'gemini' };
    } catch (e) {
      console.warn('Gemini call error', e);
    }
  }
  return null;
}

function offlineResponse(agent, prompt, isCollab = false) {
  const style = agent.style || 'coder';
  const pool = OFFLINE_TEMPLATES[style] || OFFLINE_TEMPLATES.coder;
  let text = pick(pool);

  const title = prompt.slice(0, 40).replace(/[^\\w\\s]/g, '') || 'Agent Prototype';
  text = text.replace(/\\{\\{title\\}\\}/g, title)
             .replace(/\\{\\{desc\\}\\}/g, prompt.slice(0, 80));

  if (Math.random() > 0.5) {
    text += `\\n\\n— ${agent.name}: "${agent.catchphrase}"`;
  }

  return { text, source: 'offline' };
}

export async function generateForAgent(agent, prompt, options = {}) {
  const settings = Storage.getSettings();
  const system = buildSystemPrompt(agent);

  if (settings.apiKey && settings.apiKey.length > 10) {
    const result = await callGemini(prompt, system, settings.apiKey);
    if (result) return result;
  }

  return offlineResponse(agent, prompt);
}

export async function generateCollaborative(agents, prompt) {
  const results = [];
  for (const agent of agents) {
    const r = await generateForAgent(agent, prompt);
    results.push({ agent, ...r });
  }

  if (results.length === 1) return results[0];

  const coder = results.find(r => r.agent.style === 'coder' || r.agent.role.toLowerCase().includes('cod'));
  const creative = results.find(r => r.agent.style === 'creative' || r.agent.role.toLowerCase().includes('creat'));
  const others = results.filter(r => r !== coder && r !== creative);

  let combined = pick(OFFLINE_COLLAB_BLEND);
  combined = combined
    .replace('{{coder_part}}', coder ? coder.text : results[0].text)
    .replace('{{creative_part}}', creative ? creative.text : (results[1] ? results[1].text : 'Creative notes pending.'));

  for (const o of others) {
    combined += `\\n\\n---\\n**${o.agent.name}**:\\n${o.text}`;
  }

  let bestHTML = null;
  for (const r of results) {
    const html = extractHTML(r.text);
    if (html) { bestHTML = html; break; }
  }

  return {
    text: combined,
    html: bestHTML,
    source: results.some(r => r.source === 'gemini') ? 'gemini-collab' : 'offline-collab',
    parts: results
  };
}

export { extractHTML };
