// Dual LLM system - minimal safe version
import { Storage } from './storage.js';
import { pick } from './utils.js';

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];

const OFFLINE_TEMPLATES = {
  coder: [{ text: 'Prototype outline ready. Add a Gemini API key in Settings for full HTML generation.', html: null }],
  creative: [{ text: 'Art direction: void #0d0f14, violet #7c5cfc, cyan #22d3ee. Mood: neon nostalgia.', html: null }],
  analyst: [{ text: 'Trend: multi-agent orchestration is heating up. Ship collab flow first.', html: null }],
  chaotic: [{ text: 'What if the bug is the feature?', html: null }],
  executive: [{ text: 'Status green. Prototype ready for review.', html: null }],
  support: [{ text: 'Edges cleaned. Experience should feel approachable.', html: null }]
};

function extractHTML(text) {
  if (!text) return null;
  var d = text.indexOf('<!DOCTYPE');
  if (d < 0) d = text.indexOf('<html');
  if (d >= 0) {
    var e = text.toLowerCase().indexOf('</html>', d);
    if (e > d) return text.slice(d, e + 7).trim();
  }
  return null;
}

function buildSystemPrompt(agent) {
  return 'You are ' + agent.name + ', ' + agent.role + '. ' + (agent.systemPrompt || '');
}

async function callGemini(prompt, system, apiKey) {
  for (var i = 0; i < GEMINI_MODELS.length; i++) {
    try {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODELS[i] + ':generateContent?key=' + apiKey;
      var res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: system + '\n\n' + prompt }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 2048 }
        })
      });
      if (!res.ok) continue;
      var data = await res.json();
      var text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (text) return { text: text, source: 'gemini', html: extractHTML(text) };
    } catch (e) { console.warn('Gemini error', e); }
  }
  return null;
}

function offlineResponse(agent) {
  var pool = OFFLINE_TEMPLATES[agent.style] || OFFLINE_TEMPLATES.coder;
  var item = pick(pool);
  return { text: item.text, source: 'offline', html: null };
}

export async function generateForAgent(agent, prompt) {
  var settings = Storage.getSettings();
  if (settings.apiKey && settings.apiKey.length > 10) {
    var result = await callGemini(prompt, buildSystemPrompt(agent), settings.apiKey);
    if (result) return result;
  }
  return offlineResponse(agent);
}

export async function generateCollaborative(agents, prompt) {
  var results = [];
  for (var i = 0; i < agents.length; i++) {
    results.push(Object.assign({ agent: agents[i] }, await generateForAgent(agents[i], prompt)));
  }
  if (results.length === 1) return results[0];
  var text = results.map(function(r) { return '**' + r.agent.name + '**\n' + r.text; }).join('\n\n---\n\n');
  return { text: text, html: null, source: 'offline-collab', parts: results };
}

export { extractHTML };
