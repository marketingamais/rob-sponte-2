const test = require('node:test');
const assert = require('node:assert');
const F = require('./formatos.js');

test('numero e pct', () => {
    assert.strictEqual(F.formatarNumero(1234), '1.234');
    assert.strictEqual(F.formatarNumero(0), '0');
    assert.strictEqual(F.formatarPct(0.875), '87,5%');
    assert.strictEqual(F.formatarPct(1), '100%');
    assert.strictEqual(F.formatarPct(0), '0%');
    for (const v of [null, undefined, NaN]) assert.strictEqual(F.formatarPct(v), '—');
});
test('duracao e dia', () => {
    assert.strictEqual(F.formatarDuracao(1234), '1,2 s');
    assert.strictEqual(F.formatarDuracao(65000), '1 min 5 s');
    assert.strictEqual(F.formatarDuracao(null), '—');
    assert.strictEqual(F.formatarDia('2026-09-23'), '23/09');
});
test('periodoPreset', () => {
    assert.deepStrictEqual(F.periodoPreset('hoje', '2026-09-23'), { de: '2026-09-23', ate: '2026-09-23' });
    assert.deepStrictEqual(F.periodoPreset('7d', '2026-09-23'), { de: '2026-09-17', ate: '2026-09-23' });
    assert.deepStrictEqual(F.periodoPreset('30d', '2026-03-01'), { de: '2026-01-31', ate: '2026-03-01' });
});
test('gerarSenha', () => {
    const s = F.gerarSenha();
    assert.strictEqual(s.length, 14);
    assert.match(s, /^[A-HJ-NP-Za-km-np-z2-9]+$/);
    assert.notStrictEqual(F.gerarSenha(), s);
});
