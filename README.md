# Agent Office

A browser-based management simulation where you run a chaotic virtual office of AI agents.

## Features

- **2D Interactive Office** — Canvas-rendered office with smooth waypoint pathfinding
- **4 Starter Agents** with strong personalities (Boris, Luna, Rex, Pip)
- **Multi-Agent Collaborative Tasks** — Assign 2+ agents to one project; they meet at the whiteboard and produce combined output
- **Custom Agent Creator** — Design new agents with name, emoji, color, personality, system prompt, and specialty
- **Dynamic Furniture Placement** — Decor Mode lets you drag desks, arcade machines, coffee machines, neon signs, whiteboards, etc.
- **Dual LLM System** — Optional Gemini API key for high-quality generation + rich offline fallback that still produces playable HTML prototypes
- **Live Sandboxed Preview** — Generated mini-games and pages run in a sandboxed iframe
- **Economy & Upgrades** — Earn credits from completed tasks, unlock office improvements
- **Random Office Events** — Tabs vs Spaces wars, angel investors, epiphany overdrive, coffee crises...
- **Procedural Audio** — Web Audio sound effects
- **Persistent Save** — Everything (agents, furniture layout, economy, history) saved to localStorage

## How to Run

Just open `index.html` in a modern browser, or serve the folder:

```bash
python3 -m http.server 8765
```

Then visit `http://localhost:8765`.

Or use the live GitHub Pages version once enabled.

## Controls

- **Click agent** — Select & view details
- **Assign Task** — Choose preset or freeform prompt, pick 1+ agents, enable Collaborative mode
- **Decor** — Enter placement mode, pick furniture from the toolbar, click to place. Select + Delete to remove.
- **Creator** — Design and hire custom agents (costs 150 credits)
- **Settings** — Paste a Gemini API key for live LLM responses (otherwise uses high-quality offline templates)

## Architecture

```
index.html
css/styles.css
js/
  main.js          — Boot & UI wiring
  canvas.js        — Office class, game loop, rendering, input
  agents.js        — Agent class, states, movement, personalities
  tasks.js         — Task creation, progress, multi-agent collab
  llm.js           — Gemini + offline dual system
  furniture.js     — Furniture types, placement, drawing
  events.js        — Random office events
  audio.js         — Procedural SFX
  storage.js       — localStorage persistence
  utils.js         — Helpers, pathfinding, toast, log
```

## Tech Notes

- Pure frontend (HTML + CSS + Vanilla ES modules)
- No build step required
- Target 60 fps
- Responsive enough for desktop & tablet
