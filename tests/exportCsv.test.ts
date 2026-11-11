import { describe, expect, it } from 'vitest';
import { EXPORT_COLUMNS, exportScope, toExportCsv } from '../lib/exportCsv';

const lines = (csv: string) => csv.trimEnd().split('\r\n');

describe('toExportCsv', () => {
  it('writes the header and a plain row', () => {
    const csv = toExportCsv([{ card: 'Pikachu', set: 'Base', number: '58', condition: 'NM', qty: 2, price: 1.5 }]);
    expect(lines(csv)).toEqual([EXPORT_COLUMNS.join(','), 'Pikachu,Base,58,NM,2,1.50']);
  });

  it('writes header only for no rows', () => {
    expect(lines(toExportCsv([]))).toEqual(['card,set,number,condition,qty,price']);
  });

  it('defaults blanks: qty 1, no price, no condition', () => {
    expect(lines(toExportCsv([{ card: 'A', set: 'S' }]))[1]).toBe('A,S,,,1,');
  });

  it('quotes commas and quotes', () => {
    expect(lines(toExportCsv([{ card: 'Mr. "Mime", Jr', set: 'S' }]))[1]).toBe('"Mr. ""Mime"", Jr",S,,,1,');
  });

  it('quotes newlines', () => {
    expect(toExportCsv([{ card: 'x', set: 'a\nb' }])).toContain('"a\nb"');
  });

  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])('guards formula start %j', (bad) => {
    const csv = toExportCsv([{ card: bad, set: 'S' }]);
    const body = csv.slice(csv.indexOf('\r\n') + 2);
    // The cell starts with a quote mark (maybe CSV-quoted), never the formula character.
    expect(body.startsWith(`'${bad}`) || body.startsWith(`"'${bad}`)).toBe(true);
  });

  it('guards a formula in every text column', () => {
    const row = lines(toExportCsv([{ card: '=a', set: '+b', number: '-c', condition: '@d' }]))[1];
    expect(row).toBe("'=a,'+b,'-c,'@d,1,");
  });

  it('guards a formula in a cell that also needs quoting', () => {
    expect(toExportCsv([{ card: '=a,b', set: 'S' }])).toContain('"\'=a,b"');
  });

  it('writes bad numbers as defaults', () => {
    expect(lines(toExportCsv([{ card: 'A', set: 'S', qty: 0, price: Number.NaN }]))[1]).toBe('A,S,,,1,');
  });

  it('has no notes or user id columns', () => {
    expect(EXPORT_COLUMNS).not.toContain('note' as never);
    expect(EXPORT_COLUMNS).not.toContain('user_id' as never);
  });
});

describe('exportScope', () => {
  it('says all when unfiltered', () => {
    expect(exportScope('cards', 5, 5, 0)).toBe('Exports 5 cards.');
  });
  it('says filtered', () => {
    expect(exportScope('cards', 2, 9, 1)).toBe('Exports the 2 of 9 cards that match your 1 current filter.');
  });
});
