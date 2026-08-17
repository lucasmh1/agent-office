// Dual LLM system: Gemini API + high-quality offline fallback

import { Storage } from './storage.js';
import { pick } from './utils.js';

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest'
];

const ASTEROIDS_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Asteroids</title><style>*{box-sizing:border-box;margin:0}body{background:#0a0e17;color:#e2e8f0;font-family:system-ui;display:grid;place-items:center;min-height:100vh}.wrap{text-align:center}canvas{background:#0f172a;border:2px solid #7c5cfc55;border-radius:10px;display:block;margin:12px auto}.hud{display:flex;justify-content:space-between;width:480px;margin:0 auto 8px;font-size:14px;font-weight:600}.hint{opacity:.55;font-size:12px;margin-top:8px}</style></head><body><div class="wrap"><div class="hud"><span>SCORE: <b id="score">0</b></span><span>LIVES: <b id="lives">3</b></span></div><canvas id="c" width="480" height="360"></canvas><div class="hint">Arrows rotate · Space thrust · Z shoot</div></div><script>const c=document.getElementById("c"),ctx=c.getContext("2d");let score=0,lives=3,ship={x:240,y:180,a:0,vx:0,vy:0},bullets=[],rocks=[],keys={},over=false;function spawnRock(s){s=s||2;var edge=Math.random()<0.5;rocks.push({x:edge?(Math.random()<0.5?0:480):Math.random()*480,y:edge?Math.random()*360:(Math.random()<0.5?0:360),vx:(Math.random()-0.5)*2.2,vy:(Math.random()-0.5)*2.2,r:12+s*10,s:s});}for(var i=0;i<5;i++)spawnRock(2);window.onkeydown=function(e){keys[e.key]=true;};window.onkeyup=function(e){keys[e.key]=false;};c.onclick=function(){shoot();};function shoot(){if(over)return;bullets.push({x:ship.x,y:ship.y,vx:Math.cos(ship.a)*7,vy:Math.sin(ship.a)*7,life:50});}function loop(){if(!over){if(keys["ArrowLeft"]||keys["a"])ship.a-=0.08;if(keys["ArrowRight"]||keys["d"])ship.a+=0.08;if(keys[" "]||keys["ArrowUp"]||keys["w"]){ship.vx+=Math.cos(ship.a)*0.18;ship.vy+=Math.sin(ship.a)*0.18;}if(keys["z"]||keys["Z"]){if(Math.random()<0.35)shoot();}ship.vx*=0.99;ship.vy*=0.99;ship.x=(ship.x+ship.vx+480)%480;ship.y=(ship.y+ship.vy+360)%360;}ctx.fillStyle="#0f172a";ctx.fillRect(0,0,480,360);ctx.save();ctx.translate(ship.x,ship.y);ctx.rotate(ship.a);ctx.strokeStyle="#a78bfa";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-10,9);ctx.lineTo(-6,0);ctx.lineTo(-10,-9);ctx.closePath();ctx.stroke();ctx.restore();bullets=bullets.filter(function(b){b.x+=b.vx;b.y+=b.vy;b.life--;ctx.fillStyle="#22d3ee";ctx.beginPath();ctx.arc(b.x,b.y,2.5,0,Math.PI*2);ctx.fill();return b.life>0&&b.x>0&&b.x<480&&b.y>0&&b.y<360;});rocks.forEach(function(r){r.x=(r.x+r.vx+480)%480;r.y=(r.y+r.vy+360)%360;ctx.strokeStyle="#f472b6";ctx.beginPath();for(var i=0;i<7;i++){var ang=(i/7)*Math.PI*2,rad=r.r*(0.75+Math.sin(i*3+r.x)*0.2);i===0?ctx.moveTo(r.x+Math.cos(ang)*rad,r.y+Math.sin(ang)*rad):ctx.lineTo(r.x+Math.cos(ang)*rad,r.y+Math.sin(ang)*rad);}ctx.closePath();ctx.stroke();});for(var i=rocks.length-1;i>=0;i--){var r=rocks[i];if(Math.hypot(r.x-ship.x,r.y-ship.y)<r.r+8){rocks.splice(i,1);lives--;document.getElementById("lives").textContent=lives;ship.vx=ship.vy=0;if(lives<=0)over=true;if(r.s>0){spawnRock(r.s-1);spawnRock(r.s-1);}continue;}for(var j=bullets.length-1;j>=0;j--){if(Math.hypot(r.x-bullets[j].x,r.y-bullets[j].y)<r.r){bullets.splice(j,1);rocks.splice(i,1);score+=(3-r.s)*50;document.getElementById("score").textContent=score;if(r.s>0){spawnRock(r.s-1);spawnRock(r.s-1);}break;}}}if(rocks.length<3&&!over)spawnRock(2);if(over){ctx.fillStyle="rgba(0,0,0,0.55)";ctx.fillRect(0,0,480,360);ctx.fillStyle="#fff";ctx.font="bold 28px system-ui";ctx.textAlign="center";ctx.fillText("GAME OVER",240,170);}requestAnimationFrame(loop);}loop();</script></body></html>';

const DODGE_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Dodge</title><style>*{box-sizing:border-box;margin:0}body{background:#0a0e17;color:#e2e8f0;font-family:system-ui;display:grid;place-items:center;min-height:100vh}.wrap{text-align:center}canvas{background:linear-gradient(#0f172a,#1e1b4b);border:2px solid #22d3ee44;border-radius:12px;display:block;margin:10px auto}.hud{width:360px;margin:0 auto 6px;display:flex;justify-content:space-between;font-weight:700;font-size:15px}.hint{opacity:.5;font-size:12px}</style></head><body><div class="wrap"><div class="hud"><span>SCORE: <b id="score">0</b></span><span id="hearts">❤️❤️❤️</span></div><canvas id="c" width="360" height="480"></canvas><div class="hint">Arrows or A/D to move</div></div><script>const c=document.getElementById("c"),ctx=c.getContext("2d");let score=0,lives=3,px=180,items=[],keys={},t=0,over=false;var good=["☕","⭐","💎","🚀"],bad=["🔥","💥","👾","⚡"];window.onkeydown=function(e){keys[e.key]=true;};window.onkeyup=function(e){keys[e.key]=false;};function spawn(){var isGood=Math.random()>0.45;items.push({x:20+Math.random()*320,y:-30,vy:2.2+Math.random()*2.5+score*0.01,emoji:isGood?good[Math.floor(Math.random()*good.length)]:bad[Math.floor(Math.random()*bad.length)],good:isGood});}function loop(){t++;if(!over){if(keys["ArrowLeft"]||keys["a"]||keys["A"])px-=5.5;if(keys["ArrowRight"]||keys["d"]||keys["D"])px+=5.5;px=Math.max(20,Math.min(340,px));if(t%Math.max(18,42-Math.floor(score/40))===0)spawn();}ctx.clearRect(0,0,360,480);ctx.font="28px serif";ctx.textAlign="center";ctx.fillText("🛸",px,450);items=items.filter(function(it){it.y+=it.vy;ctx.font="22px serif";ctx.fillText(it.emoji,it.x,it.y);if(it.y>430&&Math.abs(it.x-px)<28){if(it.good){score+=10;document.getElementById("score").textContent=score;}else{lives--;document.getElementById("hearts").textContent="❤️".repeat(Math.max(0,lives));if(lives<=0)over=true;}return false;}return it.y<520;});if(over){ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(0,0,360,480);ctx.fillStyle="#fff";ctx.font="bold 26px system-ui";ctx.textAlign="center";ctx.fillText("GAME OVER",180,220);ctx.font="15px system-ui";ctx.fillText("Score: "+score,180,255);}requestAnimationFrame(loop);}loop();</script></body></html>';

const OFFLINE_TEMPLATES = {
  coder: [
    { text: 'Built a playable Asteroids mini-game.\n\n```html\n' + ASTEROIDS_HTML + '\n```\n\nZero bugs.', html: ASTEROIDS_HTML },
    { text: 'Dodge falling chaos mini-game.\n\n```html\n' + DODGE_HTML + '\n```\n\nShip it.', html: DODGE_HTML }
  ],
  creative: [
    { text: 'Art direction locked in.\n\n**Palette**: void #0d0f14, violet #7c5cfc, cyan #22d3ee.\n**Mood**: neon nostalgia, late-night productivity.\n**Lore**: Agents never sleep, rarely agree, and somehow ship at 3 a.m.', html: null }
  ],
  analyst: [
    { text: 'Trend analysis: multi-agent orchestration is heating up. Playful productivity outperforms pure utility. Ship the collab flow first.', html: null }
  ],
  chaotic: [
    { text: 'OKAY LISTEN. What if the mini-game is a bug that becomes the feature?', html: null }
  ],
  executive: [
    { text: 'Strategic summary: prototype ready. Risk low. Soft launch within 48h.', html: null }
  ],
  support: [
    { text: 'Cleaned up edges. Approachable empty states and clear microcopy.', html: null }
  ]
};

const OFFLINE_COLLAB_BLEND = [
  '**Collaborative Result**\n\n{{coder_part}}\n\n---\n\n**Art notes:**\n{{creative_part}}\n\nShip it.',
  'After arguing, the agents produced:\n\n### Tech\n{{coder_part}}\n\n### Creative\n{{creative_part}}'
];

function extractHTML(text) {
  if (!text) return null;
  var marker = String.fromCharCode(96,96,96) + 'html';
  var start = text.indexOf(marker);
  if (start >= 0) {
    var after = text.indexOf(String.fromCharCode(10), start);
    if (after < 0) after = start + marker.length;
    var endMarker = String.fromCharCode(96,96,96);
    var end = text.indexOf(endMarker, after + 1);
    if (end > after) return text.slice(after + 1, end).trim();
  }
  var d = text.indexOf('<!DOCTYPE');
  if (d >= 0) {
    var e = text.toLowerCase().indexOf('</html>', d);
    if (e > d) return text.slice(d, e + 7).trim();
  }
  return null;
}

function buildSystemPrompt(agent) {
  return 'You are ' + agent.name + ', ' + agent.role + '. Personality: ' + (agent.personality || agent.catchphrase) + '. Style: ' + agent.style + '. ' + (agent.systemPrompt || '');
}

async function callGemini(prompt, system, apiKey) {
  for (var mi = 0; mi < GEMINI_MODELS.length; mi++) {
    var model = GEMINI_MODELS[mi];
    try {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
      var body = {
        contents: [{ role: 'user', parts: [{ text: system + '\n\nUser request:\n' + prompt }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 2048 }
      };
      var res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) continue;
      var data = await res.json();
      var text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (text) return { text: text, source: 'gemini', html: extractHTML(text) };
    } catch (e) { console.warn('Gemini error', e); }
  }
  return null;
}

function offlineResponse(agent, prompt) {
  var style = agent.style || 'coder';
  var pool = OFFLINE_TEMPLATES[style] || OFFLINE_TEMPLATES.coder;
  var item = pick(pool);
  var text = item.text;
  if (Math.random() > 0.5) text += '\n\n— ' + agent.name + ': "' + agent.catchphrase + '"';
  return { text: text, source: 'offline', html: item.html || extractHTML(text) };
}

export async function generateForAgent(agent, prompt) {
  var settings = Storage.getSettings();
  var system = buildSystemPrompt(agent);
  if (settings.apiKey && settings.apiKey.length > 10) {
    var result = await callGemini(prompt, system, settings.apiKey);
    if (result) return result;
  }
  return offlineResponse(agent, prompt);
}

export async function generateCollaborative(agents, prompt) {
  var results = [];
  for (var i = 0; i < agents.length; i++) {
    var r = await generateForAgent(agents[i], prompt);
    results.push(Object.assign({ agent: agents[i] }, r));
  }
  if (results.length === 1) return results[0];
  var coder = results.find(function(r) { return r.agent.style === 'coder'; });
  var creative = results.find(function(r) { return r.agent.style === 'creative'; });
  var combined = pick(OFFLINE_COLLAB_BLEND);
  combined = combined.replace('{{coder_part}}', coder ? coder.text : results[0].text).replace('{{creative_part}}', creative ? creative.text : (results[1] ? results[1].text : 'pending'));
  var bestHTML = null;
  for (var j = 0; j < results.length; j++) {
    if (results[j].html) { bestHTML = results[j].html; break; }
    var html = extractHTML(results[j].text);
    if (html) { bestHTML = html; break; }
  }
  return { text: combined, html: bestHTML, source: 'offline-collab', parts: results };
}

export { extractHTML };
