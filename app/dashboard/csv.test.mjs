import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { csvCell, csvRows } from './csv.ts';

test('CSV quotes text, preserves numbers and leaves unavailable values blank', () => {
  assert.equal(csvRows([['source', 'visitors'], ['a,"b"', 4], ['unknown', null]]), '"source","visitors"\r\n"a,""b""","4"\r\n"unknown",""\r\n');
});
test('CSV neutralizes spreadsheet formulas including leading whitespace and control characters', () => {
  for (const input of ['=1+1', '+1', '-2', '@SUM(A1)', '  =cmd', '\ttext', '\rtest']) assert.ok(csvCell(input).startsWith('"\''));
  assert.equal(csvCell('newsletter'), '"newsletter"');
});
