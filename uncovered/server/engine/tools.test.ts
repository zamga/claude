import { describe, expect, it } from 'vitest';
import { Leads, researchTools, searchResultUrls } from './tools';

describe('research tools', () => {
  const tools = researchTools('SI');
  const json = JSON.stringify(tools);

  it('declares strict schemas without keywords strict mode rejects', () => {
    expect(json).not.toMatch(/"(?:minimum|maximum|minLength|maxLength|pattern|\$schema)"/);
    for (const t of tools) if ('input_schema' in t) expect(t.strict).toBe(true);
  });

  it('keeps every parameter required and every object closed', () => {
    const walk = (s: unknown): void => {
      if (Array.isArray(s)) return s.forEach(walk);
      if (!s || typeof s !== 'object') return;
      const o = s as Record<string, unknown>;
      if (o.type === 'object') {
        expect(o.additionalProperties).toBe(false);
        expect(new Set(o.required as string[])).toEqual(new Set(Object.keys(o.properties as object)));
      }
      Object.values(o).forEach(walk);
    };
    for (const t of tools) if ('input_schema' in t) walk(t.input_schema);
  });

  it('calls web search directly, so the engine sees every result', () => {
    expect(tools[0]).toMatchObject({ type: 'web_search_20260209', allowed_callers: ['direct'] });
    expect(researchTools('XX')[0]).not.toHaveProperty('user_location');
  });
});

describe('addresses the model may read', () => {
  it('matches addresses regardless of fragment, host case and trailing slash', () => {
    const leads = new Leads();
    leads.add('https://WWW.Primer.si/en/investors/#reports');
    expect(leads.has('https://www.primer.si/en/investors')).toBe(true);
    expect(leads.has('https://www.primer.si/en/investors/?q=1')).toBe(false);
    expect(leads.has('javascript:alert(1)')).toBe(false);
  });

  it('collects the addresses in search results with their query', () => {
    const found = searchResultUrls([
      {
        type: 'server_tool_use',
        id: 'srv1',
        name: 'web_search',
        input: { query: 'Primer letno poročilo' },
        caller: { type: 'direct' },
      },
      {
        type: 'web_search_tool_result',
        tool_use_id: 'srv1',
        caller: { type: 'direct' },
        content: [
          {
            type: 'web_search_result',
            url: 'https://www.primer.si/lp2025.pdf',
            title: 'LP 2025',
            page_age: null,
            encrypted_content: 'x',
          },
        ],
      },
    ] as never);
    expect(found).toEqual([{ query: 'Primer letno poročilo', urls: ['https://www.primer.si/lp2025.pdf'] }]);
  });
});
