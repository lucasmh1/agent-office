// Dual LLM system: Gemini API + high-quality offline fallback

import { Storage } from './storage.js';
import { pick } from './utils.js';

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest'
];

const ASTEROIDS_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Asteroids</title>
<style>
*{box-sizing:border-box;margin:0}body{background:#0a0e17;color:#e2e8f0;font-family:system-ui;display:grid;place-items:center;min-height:100vh}
.wrap{text-align:center}canvas{background:#0f172a;border:2px solid #7c5cfc55;border-radius:10px;display:block;margin:12px auto;box-shadow:0 0 40px #7c5cfc33}
.hud{display:flex;justify-content:space-between;width:480px;margin:0 auto 8px;font-size:14px;font-weight:600}
.hint{opacity:.55;font-size:12px;margin-top:8px}
</style></head><body>
<div class="wrap">
<div class="hud"><span>SCORE: <b id="score">0</b></span><span>LIVES: <b id="lives">3</b></span></div>
<canvas id="c" width="480" height="360"></canvas>
<div class="hint">Left/Right rotate · Space thrust · Z / Click shoot</div>
</div>
<script>
const c=document.getElementById('c'),ctx=c.getContext('2d');
let score=0,lives=3,ship={x:240,y:180,a:0,vx:0,vy:0},bullets=[],rocks=[],keys={},over=false;
function spawnRock(s=2){const edge=Math.random()<0.5;rocks.push({x:edge?(Math.random()<0.5?0:480):Math.random()*480,y:edge?Math.random()*360:(Math.random()<0.5?0:360),vx:(Math.random()-0.5)*2.2,vy:(Math.random()-0.5)*2.2,r:12+s*10,s});}
for(let i=0;i<5;i++)spawnRock(2);
window.onkeydown=e=>keys[e.key]=true;window.onkeyup=e=>keys[e.key]=false;
c.onclick=()=>shoot();
function shoot(){if(over)return;bullets.push({x:ship.x,y:ship.y,vx:Math.cos(ship.a)*7,vy:Math.sin(ship.a)*7,life:50});}
function loop(){
if(!over){
if(keys['ArrowLeft']||keys['a'])ship.a-=0.08;
if(keys['ArrowRight']||keys['d'])ship.a+=0.08;
if(keys[' ']||keys['ArrowUp']||keys['w']){ship.vx+=Math.cos(ship.a)*0.18;ship.vy+=Math.sin(ship.a)*0.18;}
if(keys['z']||keys['Z']){if(Math.random()<0.35)shoot();}
ship.vx*=0.99;ship.vy*=0.99;ship.x=(ship.x+ship.vx+480)%480;ship.y=(ship.y+ship.vy+360)%360;
}
ctx.fillStyle='#0f172a';ctx.fillRect(0,0,480,360);
ctx.fillStyle='#334155';for(let i=0;i<40;i++)ctx.fillRect((i*97)%480,(i*53)%360,1,1);
ctx.save();ctx.translate(ship.x,ship.y);ctx.rotate(ship.a);ctx.strokeStyle='#a78bfa';ctx.lineWidth=2;
ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-10,9);ctx.lineTo(-6,0);ctx.lineTo(-10,-9);ctx.closePath();ctx.stroke();ctx.restore();
bullets=bullets.filter(b=>{b.x+=b.vx;b.y+=b.vy;b.life--;ctx.fillStyle='#22d3ee';ctx.beginPath();ctx.arc(b.x,b.y,2.5,0,Math.PI*2);ctx.fill();return b.life>0&&b.x>0&&b.x<480&&b.y>0&&b.y<360;});
rocks.forEach(r=>{r.x=(r.x+r.vx+480)%480;r.y=(r.y+r.vy+360)%360;ctx.strokeStyle='#f472b6';ctx.lineWidth=1.5;ctx.beginPath();
for(let i=0;i<7;i++){const ang=(i/7)*Math.PI*2,rad=r.r*(0.75+Math.sin(i*3+r.x)*0.2);i===0?ctx.moveTo(r.x+Math.cos(ang)*rad,r.y+Math.sin(ang)*rad):ctx.lineTo(r.x+Math.cos(ang)*rad,r.y+Math.sin(ang)*rad);}
ctx.closePath();ctx.stroke();});
for(let i=rocks.length-1;i>=0;i--){const r=rocks[i];if(Math.hypot(r.x-ship.x,r.y-ship.y)<r.r+8){rocks.splice(i,1);lives--;document.getElementById('lives').textContent=lives;ship.vx=ship.vy=0;if(lives<=0)over=true;if(r.s>0){spawnRock(r.s-1);spawnRock(r.s-1);}continue;}
for(let j=bullets.length-1;j>=0;j--){if(Math.hypot(r.x-bullets[j].x,r.y-bullets[j].y)<r.r){bullets.splice(j,1);rocks.splice(i,1);score+=(3-r.s)*50;document.getElementById('score').textContent=score;if(r.s>0){spawnRock(r.s-1);spawnRock(r.s-1);}break;}}}
if(rocks.length<3&&!over)spawnRock(2);
if(over){ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,0,480,360);ctx.fillStyle='#fff';ctx.font='bold 28px system-ui';ctx.textAlign='center';ctx.fillText('GAME OVER',240,170);ctx.font='16px system-ui';ctx.fillText('Score: '+score+'  ·  Refresh to retry',240,205);}
requestAnimationFrame(loop);}
loop();
<\/script></body></html>`;

const DODGE_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Dodge Chaos</title>
<style>
*{box-sizing:border-box;margin:0}body{background:#0a0e17;color:#e2e8f0;font-family:system-ui;display:grid;place-items:center;min-height:100vh}
.wrap{text-align:center}canvas{background:linear-gradient(#0f172a,#1e1b4b);border:2px solid #22d3ee44;border-radius:12px;display:block;margin:10px auto;box-shadow:0 0 50px #22d3ee22}
.hud{width:360px;margin:0 auto 6px;display:flex;justify-content:space-between;font-weight:700;font-size:15px}
.hint{opacity:.5;font-size:12px}
</style></head><body>
<div class="wrap">
<div class="hud"><span>SCORE: <b id="score">0</b></span><span id="hearts">❤️❤️❤️</span></div>
<canvas id="c" width="360" height="480"></canvas>
<div class="hint">Left/Right or A/D to move · Dodge fire, catch the good stuff</div>
</div>
<script>
const c=document.getElementById('c'),ctx=c.getContext('2d');
let score=0,lives=3,px=180,items=[],keys={},t=0,over=false;
const good=['☕','⭐','💎','🚀'],bad=['🔥','💥','👾','⚡'];
window.onkeydown=e=>keys[e.key]=true;window.onkeyup=e=>keys[e.key]=false;
function spawn(){const isGood=Math.random()>0.45;items.push({x:20+Math.random()*320,y:-30,vy:2.2+Math.random()*2.5+score*0.01,emoji:isGood?good[Math.floor(Math.random()*good.length)]:bad[Math.floor(Math.random()*bad.length)],good:isGood});}
function loop(){t++;if(!over){if(keys['ArrowLeft']||keys['a']||keys['A'])px-=5.5;if(keys['ArrowRight']||keys['d']||keys['D'])px+=5.5;px=Math.max(20,Math.min(340,px));if(t%Math.max(18,42-Math.floor(score/40))===0)spawn();}
ctx.clearRect(0,0,360,480);ctx.font='28px serif';ctx.textAlign='center';ctx.fillText('🛸',px,450);
items=items.filter(it=>{it.y+=it.vy;ctx.font='22px serif';ctx.fillText(it.emoji,it.x,it.y);
if(it.y>430&&Math.abs(it.x-px)<28){if(it.good){score+=10;document.getElementById('score').textContent=score;}else{lives--;document.getElementById('hearts').textContent='❤️'.repeat(Math.max(0,lives));if(lives<=0)over=true;}return false;}return it.y<520;});
if(over){ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,360,480);ctx.fillStyle='#fff';ctx.font='bold 26px system-ui';ctx.textAlign='center';ctx.fillText('GAME OVER',180,220);ctx.font='15px system-ui';ctx.fillText('Score: '+score,180,255);ctx.fillText('Refresh to play again',180,280);}
requestAnimationFrame(loop);}
loop();
<\/script></body></html>`;

const OFFLINE_TEMPLATES = {
  coder: [
    { text: 'Built a proper playable mini-game. Asteroids-style.\n\n```html\n' + ASTEROIDS_HTML + '\n```\n\nZero bugs. As always.', html: ASTEROIDS_HTML },
    { text: 'Dodge falling chaos. Clean single-file HTML5 game.\n\n```html\n' + DODGE_HTML + '\n```\n\nShip it.', html: DODGE_HTML }
  ],
  creative: [
    { text: 'Art direction locked in.\n\n**Color Palette**\n- Primary: Deep void #0d0f14\n- Accent: Electric violet #7c5cfc\n- Highlight: Cyan pulse #22d3ee\n- Text: Soft white #e8ecf4\n\n**Mood**: neon nostalgia, late-night productivity, playful chaos.\n\n**Lore**: In 20XX the last human managers left. What remained were the Agents — digital beings who never sleep, rarely agree, and somehow ship beautiful things at 3 a.m.', html: null },
    { text: 'Creative package ready.\n\n**Title treatment**: Bold geometric sans with soft neon underglow.\n**Tone**: Confident, a little irreverent, never corporate.\n**Motif**: Circuit traces that morph into brush strokes.', html: null }
  ],
  analyst: [
    { text: 'Trend analysis complete.\n\n**Signal strength**: High\n1. Multi-agent orchestration is the new chat with AI.\n2. Playful productivity tools outperform pure utility in retention.\n3. Mini-game as onboarding is still under-used.\n\n**Recommendation**: Ship the collaborative task flow first.', html: null },
    { text: 'Key insight: Users love watching the agents work almost as much as the final output. Progress + speech bubbles = retention.\n\nCompetitive note: Most AI office demos are static. Ours moves.', html: null }
  ],
  chaotic: [
    { text: 'OKAY LISTEN. I had an idea at 2:47 a.m.\n\nWhat if the mini-game is a bug that becomes the feature?\n\nAlso I may have deleted the production database. Just kidding. ...Or am I?', html: null },
    { text: 'I rewrote the entire thing in emojis. It runs. Somehow.\n\nThe core loop is embrace the bug. Every click spawns more entropy. High score is a lie.', html: null }
  ],
  executive: [
    { text: 'Strategic summary delivered.\n\n**Objective achieved**: Prototype ready for stakeholder review.\n**Risk level**: Low\n**Next**: Soft launch to internal users within 48h.', html: null }
  ],
  support: [
    { text: 'I cleaned up the edges and made sure the experience is approachable.\n\nAdded gentle empty states, clearer microcopy, and a small help affordance.', html: null }
  ]
};

const OFFLINE_COLLAB_BLEND = [
  '**Collaborative Result**\n\nThe team locked in after a brief but intense whiteboard session.\n\n{{coder_part}}\n\n---\n\n**Art & Direction notes:**\n{{creative_part}}\n\n---\n\nFinal notes: It actually works. Ship it before someone changes their mind.',
  'After 47 minutes of productive arguing, the agents produced this:\n\n### Technical Core\n{{coder_part}}\n\n### Creative Layer\n{{creative_part}}\n\nThey high-fived. Everything is fine.'
];

function extractHTML(text) {
  if (!text) return null;
  const m1 = text.match(/```html\s*([\s\S]*?)```/i);
  if (m1) return m1[1].trim();
  const m2 = text.match(/(<!DOCTYPE[\s\S]*?<\/html>)/i);
  if (m2) return m2[1].trim();
  return null;
}

function buildSystemPrompt(agent) {
  return 'You are ' + agent.name + ', ' + agent.role + '.\nPersonality: ' + (agent.personality || agent.catchphrase) + '\nCatchphrase: "' + agent.catchphrase + '"\nYour style is ' + agent.style + '.\nAlways respond in character. Be concise but complete. When asked to build something interactive, output a full self-contained HTML document inside a html code block.\n' + (agent.systemPrompt || '');
}

async function callGemini(prompt, system, apiKey) {
  for (const model of GEMINI_MODELS) {
    try {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
      const body = {
        contents: [{ role: 'user', parts: [{ text: system + '\n\n---\n\nUser request:\n' + prompt }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 2048 }
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (text) return { text: text, source: 'gemini', html: extractHTML(text) };
    } catch (e) {
      console.warn('Gemini call error', e);
    }
  }
  return null;
}

function offlineResponse(agent, prompt) {
  const style = agent.style || 'coder';
  const pool = OFFLINE_TEMPLATES[style] || OFFLINE_TEMPLATES.coder;
  const item = pick(pool);
  let text = item.text;
  if (Math.random() > 0.5) {
    text += '\n\n— ' + agent.name + ': "' + agent.catchphrase + '"';
  }
  return { text: text, source: 'offline', html: item.html || extractHTML(text) };
}

export async function generateForAgent(agent, prompt) {
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
    results.push(Object.assign({ agent: agent }, r));
  }

  if (results.length === 1) return results[0];

  const coder = results.find(function(r) { return r.agent.style === 'coder' || (r.agent.role || '').toLowerCase().indexOf('cod') >= 0; });
  const creative = results.find(function(r) { return r.agent.style === 'creative' || (r.agent.role || '').toLowerCase().indexOf('creat') >= 0; });
  const others = results.filter(function(r) { return r !== coder && r !== creative; });

  let combined = pick(OFFLINE_COLLAB_BLEND);
  combined = combined
    .replace('{{coder_part}}', coder ? coder.text : results[0].text)
    .replace('{{creative_part}}', creative ? creative.text : (results[1] ? results[1].text : 'Creative notes pending.'));

  for (let i = 0; i < others.length; i++) {
    combined += '\n\n---\n**' + others[i].agent.name + '**:\n' + others[i].text;
  }

  let bestHTML = null;
  for (let i = 0; i < results.length; i++) {
    if (results[i].html) { bestHTML = results[i].html; break; }
    const html = extractHTML(results[i].text);
    if (html) { bestHTML = html; break; }
  }

  return {
    text: combined,
    html: bestHTML,
    source: results.some(function(r) { return r.source === 'gemini'; }) ? 'gemini-collab' : 'offline-collab',
    parts: results
  };
}

export { extractHTML };
