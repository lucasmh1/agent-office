// Persistent storage via localStorage

const KEYS = {
  agents: 'ao_agents',
  furniture: 'ao_furniture',
  tasks: 'ao_completed_tasks',
  economy: 'ao_economy',
  settings: 'ao_settings',
  upgrades: 'ao_upgrades',
  customAgents: 'ao_custom_agents'
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage save failed', e);
  }
}

export const Storage = {
  getAgents() {
    return load(KEYS.agents, null);
  },
  setAgents(agents) {
    // Only persist serializable state
    const data = agents.map(a => ({
      id: a.id,
      name: a.name,
      role: a.role,
      emoji: a.emoji,
      color: a.color,
      style: a.style,
      catchphrase: a.catchphrase,
      personality: a.personality,
      systemPrompt: a.systemPrompt,
      isCustom: a.isCustom || false,
      hiredAt: a.hiredAt || Date.now()
    }));
    save(KEYS.agents, data);
  },

  getCustomAgents() {
    return load(KEYS.customAgents, []);
  },
  setCustomAgents(list) {
    save(KEYS.customAgents, list);
  },

  getFurniture() {
    return load(KEYS.furniture, null);
  },
  setFurniture(items) {
    save(KEYS.furniture, items);
  },

  getCompletedTasks() {
    return load(KEYS.tasks, []);
  },
  addCompletedTask(task) {
    const list = load(KEYS.tasks, []);
    list.unshift(task);
    if (list.length > 50) list.length = 50;
    save(KEYS.tasks, list);
  },

  getEconomy() {
    return load(KEYS.economy, { money: 1250, reputation: 12 });
  },
  setEconomy(eco) {
    save(KEYS.economy, eco);
  },

  getSettings() {
    return load(KEYS.settings, {
      apiKey: '',
      sfx: true,
      music: false
    });
  },
  setSettings(s) {
    save(KEYS.settings, s);
  },

  getUpgrades() {
    return load(KEYS.upgrades, {});
  },
  setUpgrades(u) {
    save(KEYS.upgrades, u);
  },

  resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }
};
