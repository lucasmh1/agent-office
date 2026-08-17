// Random office events

import { pick, randomRange } from './utils.js';
import { Audio } from './audio.js';
import { logEvent, toast } from './utils.js';

const EVENTS = [
  {
    id: 'tabs_spaces',
    title: 'Tabs vs Spaces War',
    weight: 1,
    run(office) {
      const a = pick(office.agents.filter(x => !x.isBusy));
      const b = pick(office.agents.filter(x => x !== a && !x.isBusy));
      if (!a || !b) return;
      a.say('TABS ARE SUPERIOR', 4);
      b.say('SPACES OR NOTHING', 4);
      a.setState('arguing', 5);
      b.setState('arguing', 5);
      logEvent('🔥 Tabs vs Spaces war erupted!', true);
      Audio.event();
      setTimeout(() => {
        toast('The war ended in a draw. Productivity -10%', 'warning');
      }, 4000);
    }
  },
  {
    id: 'epiphany',
    title: 'Epiphany Overdrive',
    weight: 0.8,
    run(office) {
      const a = pick(office.agents.filter(x => !x.isBusy));
      if (!a) return;
      a.say('WAIT. I JUST FIGURED IT OUT.', 3.5);
      a.setState('celebrating', 4);
      office.addMoney(35);
      office.addReputation(1);
      logEvent(`${a.name} had an epiphany! +35 credits`, true);
      toast('💡 Epiphany! +35 💰', 'success');
      Audio.success();
    }
  },
  {
    id: 'angel',
    title: 'Angel Investor Visit',
    weight: 0.4,
    run(office) {
      logEvent('👼 An angel investor wandered in...', true);
      toast('Angel Investor appeared!', 'success');
      Audio.coin();
      setTimeout(() => {
        const amount = 150 + Math.floor(Math.random() * 200);
        office.addMoney(amount);
        office.addReputation(3);
        logEvent(`Angel invested ${amount} credits!`, true);
        toast(`💸 +${amount} from angel investor`, 'success');
        Audio.coin();
      }, 2500);
    }
  },
  {
    id: 'coffee_crisis',
    title: 'Coffee Crisis',
    weight: 0.9,
    run(office) {
      office.agents.forEach(a => {
        if (!a.isBusy && Math.random() > 0.4) {
          a.say(pick(['Where is the coffee?!', 'I need caffeine.', 'The machine is empty...']), 3);
        }
      });
      logEvent('☕ Coffee crisis! Agents are restless.');
      toast('Coffee machine ran dry', 'warning');
      Audio.coffee();
    }
  },
  {
    id: 'bug_hunt',
    title: 'Emergency Bug Hunt',
    weight: 0.7,
    run(office) {
      const coders = office.agents.filter(a => a.style === 'coder' || a.role.toLowerCase().includes('cod'));
      const target = pick(coders.length ? coders : office.agents);
      if (!target || target.isBusy) return;
      target.say('Production is on fire. I got this.', 3);
      target.startWorking('bug-' + Date.now());
      setTimeout(() => {
        target.goIdle();
        target.say('Fixed. Never speak of this.', 2.5);
        office.addMoney(50);
        logEvent(`${target.name} squashed a critical bug. +50`, true);
        toast('🐛 Bug squashed +50 💰', 'success');
        Audio.success();
      }, 6000);
    }
  },
  {
    id: 'dance',
    title: 'Spontaneous Dance Break',
    weight: 0.5,
    run(office) {
      office.agents.forEach(a => {
        if (!a.isBusy) {
          a.say(pick(['🕺', 'Let\'s gooo', 'Dance protocol activated']), 2.5);
          a.setState('celebrating', 3);
        }
      });
      logEvent('🕺 Spontaneous dance break!');
      Audio.collaborate();
    }
  },
  {
    id: 'power_nap',
    title: 'Power Nap Cascade',
    weight: 0.6,
    run(office) {
      const a = pick(office.agents.filter(x => !x.isBusy));
      if (!a) return;
      a.say('Just 5 minutes...', 3);
      a.setState('idle', 8);
      logEvent(`${a.name} is taking a power nap.`);
    }
  },
  {
    id: 'meme',
    title: 'Meme Overflow',
    weight: 0.7,
    run(office) {
      const a = pick(office.agents);
      if (!a) return;
      a.say(pick([
        'This is fine.',
        'Ship it Friday.',
        'It works on my machine.',
        'Have you tried turning it off and on again?',
        'Works in prod 🔥'
      ]), 3.5);
      logEvent('Meme energy detected.');
    }
  }
];

export class EventSystem {
  constructor(office) {
    this.office = office;
    this.timer = randomRange(25, 50);
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.fireRandom();
      this.timer = randomRange(35, 75);
    }
  }

  fireRandom() {
    const total = EVENTS.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const ev of EVENTS) {
      r -= ev.weight;
      if (r <= 0) {
        try {
          ev.run(this.office);
        } catch (e) {
          console.warn('Event error', e);
        }
        break;
      }
    }
  }
}
