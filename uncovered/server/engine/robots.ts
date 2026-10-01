/*
 * robots.txt, as RFC 9309 describes it: the group for our agent, else the
 * group for "*"; the longest matching rule wins, and Allow wins a tie.
 */

interface Rule {
  allow: boolean;
  pattern: string;
}

export interface Robots {
  allows(path: string): boolean;
}

const ALLOW_ALL: Robots = { allows: () => true };

function matcher(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

export function parseRobots(text: string, agent: string): Robots {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | undefined;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      if (key === 'disallow' && value === '') continue;
      current.rules.push({ allow: key === 'allow', pattern: value });
    }
  }
  const name = agent.toLowerCase();
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && name.includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules).map((r) => ({ ...r, re: matcher(r.pattern) }));
  if (rules.length === 0) return ALLOW_ALL;
  return {
    allows(path: string) {
      let best: { allow: boolean; length: number } | undefined;
      for (const r of rules) {
        if (!r.re.test(path)) continue;
        const length = r.pattern.length;
        if (!best || length > best.length || (length === best.length && r.allow)) best = { allow: r.allow, length };
      }
      return best?.allow ?? true;
    },
  };
}

export { ALLOW_ALL };
