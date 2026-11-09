import { describe, expect, it } from 'vitest';
import { formatListText } from '../lib/listText';

describe('formatListText', () => {
  it('groups by set, sorts, and marks qty and high priority', () => {
    const text = formatListText('Wants', [
      { name: 'Pineco', setName: 'Scarlet & Violet' },
      { name: 'Charizard', setName: 'Base', qty: 2, priority: 'high' },
      { name: 'Abra', setName: 'Base', priority: 'low' },
    ]);
    expect(text).toBe(
      ['Wants (3 cards)', '', 'Base', '- Abra', '- Charizard x2 (high priority)', '', 'Scarlet & Violet', '- Pineco'].join('\n')
    );
  });

  it('puts cards without a set last under Other', () => {
    const text = formatListText('Binder', [{ name: 'Mew' }, { name: 'Zubat', setName: 'Base' }]);
    expect(text.split('\n').slice(-2)).toEqual(['Other', '- Mew']);
  });

  it('handles empty lists and singular count', () => {
    expect(formatListText('Wants', [])).toBe('Wants: nothing yet');
    expect(formatListText('Wants', [{ name: 'Mew', setName: 'Base' }])).toContain('(1 card)');
  });

  it('never includes hidden or extra fields', () => {
    const row = { name: 'Mew', setName: 'Base', postcode_prefix: 'SW1', note: 'secret', user_id: 'u1' };
    const text = formatListText('Wants', [row]);
    expect(text).not.toMatch(/SW1|secret|u1|postcode/);
  });

  it('collapses whitespace and newlines in names', () => {
    expect(formatListText('Wants', [{ name: 'A\n- B  C', setName: 'Base' }])).toContain('- A - B C');
  });
});
