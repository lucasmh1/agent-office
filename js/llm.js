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
    `Here's a clean implementation. I went with vanilla JS + a tiny state machine so it stays portable.\n\n\`\`\`html\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>{{title}}</title>\n  <style>\n    body { font-family: system-ui; background: #0f172a; color: #e2e8f0; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }\n    .card { background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.4); max-width: 420px; text-align: center; }\n    button { background: #7c5cfc; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 1rem; }\n    button:hover { background: #9478ff; }\n    .score { font-size: 2.5rem; font-weight: 700; margin: 1rem 0; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <h1>{{title}}</h1>\n    <p>{{desc}}</p>\n    <div class="score" id="score">0</div>\n    <button id="btn">Do the thing</button>\n  </div>\n  <script>\n    let score = 0;\n    document.getElementById('btn').onclick = () => {\n      score += Math.floor(Math.random() * 10) + 1;\n      document.getElementById('score').textContent = score;\n    };\n  <\/script>\n</body>\n</html>\n\`\`\`\n\nZero bugs. As always.`,

    `I shipped a small interactive prototype. Focused on clarity and zero dependencies.\n\n\`\`\`html\n<!DOCTYPE html>\n<html>\n<head>\n  <title>{{title}}</title>\n  <style>\n    * { box-sizing: border-box; }\n    body { margin: 0; background: #111; color: #eee; font-family: 'Segoe UI', sans-serif; display: grid; place-items: center; min-height: 100vh; }\n    .game { width: 320px; }\n    canvas { background: #1a1a2e; border-radius: 8px; display: block; width: 100%; }\n    .hud { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }\n  </style>\n</head>\n<body>\n  <div class="game">\n    <div class="hud"><span>Score: <b id="s">0</b></span><span>Click to play</span></div>\n    <canvas id="c" width="320" height="240"></canvas>\n  </div>\n  <script>\n    const c = document.getElementById('c');\n    const ctx = c.getContext('2d');\n    let score = 0, x = 160, y = 120, vx = 2, vy = 1.5;\n    function loop() {\n      ctx.fillStyle = '#1a1a2e';\n      ctx.fillRect(0,0,320,240);\n      x += vx; y += vy;\n      if (x < 10 || x > 310) vx *= -1;\n      if (y < 10 || y > 230) vy *= -1;\n      ctx.beginPath();\n      ctx.arc(x,y,12,0,Math.PI*2);\n      ctx.fillStyle = '#7c5cfc';\n      ctx.fill();\n      requestAnimationFrame(loop);\n    }\n    c.onclick = () => { score++; document.getElementById('s').textContent = score; vx *= 1.05; vy *= 1.05; };\n    loop();\n  <\/script>\n</body>\n</html>\n\`\`\`\n\nShip it.`
  ],
  creative: [
    `Art direction locked in. Here's the visual language + lore foundation:\n\n**Color Palette**\n- Primary: Deep void #0d0f14\n- Accent: Electric violet #7c5cfc\n- Highlight: Cyan pulse #22d3ee\n- Text: Soft white #e8ecf4\n\n**Mood Board Keywords**: neon nostalgia, late-night productivity, playful chaos, soft absurdity\n\n**Lore Snippet**\nIn the year 20XX the last human managers left the building. What remained were the Agents — digital beings who never sleep, rarely agree, and somehow ship beautiful things at 3 a.m.\n\n**Micro-interaction idea**: When agents high-five after a successful collab, a tiny constellation of particles forms the word "SHIPPED" for half a second.\n\nI also sketched a simple hero illustration concept (described):\nA glowing monitor surrounded by floating sticky notes, a half-empty coffee mug, and two silhouettes arguing about tabs vs spaces while a third agent quietly ships the feature in the background.`,

    `Creative package ready.\n\n**Title treatment**: Bold geometric sans, slight tracking, with a soft neon underglow.\n\n**Tone of voice**: Confident, a little irreverent, never corporate.\n\n**Key visual motif**: Circuit traces that morph into brush strokes — the perfect marriage of code and craft.\n\n**Short interactive story beat**:\n> You open the office door. The lights are already on. Someone left a sticky note on your monitor:\n> "The agents finished the prototype while you were getting coffee. Don't ask how."\n> A soft chime plays. The prototype is waiting.`
  ],
  analyst: [
    `Trend analysis complete.\n\n**Signal strength**: High\n**Relevant vectors**:\n1. Agent collaboration UX is heating up — multi-agent orchestration is the new "chat with AI".\n2. Playful productivity tools outperform pure utility by ~40% in retention (internal benchmarks + public case studies).\n3. Mini-game as onboarding is still under-used in B2B SaaS.\n\n**Recommendation**: Ship the collaborative task flow first. The "agents arguing then high-fiving" loop is pure engagement gold.\n\n**Quick data sketch**:\n- Expected session length lift: +18–25%\n- Shareability of generated mini-games: high\n- Risk: token cost if using live LLM for every agent action → mitigate with smart caching + offline fallback.`,

    `I pulled the latest signals.\n\nKey insight: Users love *watching* the agents work almost as much as the final output. Progress visualization + speech bubbles = retention.\n\nCompetitive note: Most "AI office" demos are static. Ours moves. That alone is differentiation.`
  ],
  chaotic: [
    `OKAY LISTEN. I had an idea at 2:47 a.m. and I refuse to let it die.\n\nWhat if the mini-game is a *bug* that becomes the feature?\n\n\`\`\`html\n<!DOCTYPE html>\n<html>\n<head><title>Chaos Mode</title>\n<style>\n  body { margin:0; background:#1a0033; overflow:hidden; }\n  #arena { width:100vw; height:100vh; position:relative; }\n  .bug { position:absolute; font-size:32px; cursor:pointer; transition: transform 0.1s; }\n  .bug:hover { transform: scale(1.4) rotate(15deg); }\n  #score { position:fixed; top:20px; left:20px; color:#0f0; font-family:monospace; font-size:24px; }\n</style>\n</head>\n<body>\n  <div id="score">CHAOS: 0</div>\n  <div id="arena"></div>\n  <script>\n    let score = 0;\n    const emojis = ['🐛','🔥','💥','🌀','⚡','🛸','👾'];\n    function spawn() {\n      const b = document.createElement('div');\n      b.className = 'bug';\n      b.textContent = emojis[Math.floor(Math.random()*emojis.length)];\n      b.style.left = Math.random()*90 + '%';\n      b.style.top = Math.random()*90 + '%';\n      b.onclick = () => {\n        score += Math.floor(Math.random()*50)-10;\n        document.getElementById('score').textContent = 'CHAOS: ' + score;\n        b.remove();\n        if (Math.random() > 0.6) spawn();\n      };\n      document.getElementById('arena').appendChild(b);\n      setTimeout(() => b.remove(), 3000 + Math.random()*2000);\n    }\n    setInterval(spawn, 600);\n    spawn();\n  <\/script>\n</body>\n</html>\n\`\`\`\n\nAlso I may have deleted the production database. Just kidding. ...Or am I?`,

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
  const match = text.match(/```html\s*([\s\S]*?)```/i) || text.match(/```\s*(<!DOCTYPE[\s\S]*?<\/html>)/i);
  return match ? match[1].trim() : null;
}

function buildSystemPrompt(agent) {
  return `You are ${agent.name}, ${agent.role}.\nPersonality: ${agent.personality || agent.catchphrase}\nCatchphrase: "${agent.catchphrase}"\nYour style is ${agent.style}.\nAlways respond in character. Be concise but complete. When asked to build something interactive, output a full self-contained HTML document inside a \`\`\`html code block.\n${agent.systemPrompt || ''}`;
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
            parts: [{ text: `${system}\n\n---\n\nUser request:\n${prompt}` }]
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

  // Simple template fill
  const title = prompt.slice(0, 40).replace(/[^\w\s]/g, '') || 'Agent Prototype';
  text = text.replace(/\{\{title\}\}/g, title)
             .replace(/\{\{desc\}\}/g, prompt.slice(0, 80));

  // Add a touch of personality
  if (Math.random() > 0.5) {
    text += `\n\n— ${agent.name}: "${agent.catchphrase}"`;
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

  // Fallback
  return offlineResponse(agent, prompt);
}

export async function generateCollaborative(agents, prompt) {
  // Run agents in parallel (or sequential for offline consistency)
  const results = [];
  for (const agent of agents) {
    const r = await generateForAgent(agent, prompt);
    results.push({ agent, ...r });
  }

  // Combine
  if (results.length === 1) return results[0];

  const coder = results.find(r => r.agent.style === 'coder' || r.agent.role.toLowerCase().includes('cod'));
  const creative = results.find(r => r.agent.style === 'creative' || r.agent.role.toLowerCase().includes('creat'));
  const others = results.filter(r => r !== coder && r !== creative);

  let combined = pick(OFFLINE_COLLAB_BLEND);
  combined = combined
    .replace('{{coder_part}}', coder ? coder.text : results[0].text)
    .replace('{{creative_part}}', creative ? creative.text : (results[1] ? results[1].text : 'Creative notes pending.'));

  // Append remaining
  for (const o of others) {
    combined += `\n\n---\n**${o.agent.name}**:\n${o.text}`;
  }

  // Prefer real HTML from any agent that produced it
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
