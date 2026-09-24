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
test('periodoAnterior: mesma duracao, terminando na vespera', () => {
    assert.deepStrictEqual(F.periodoAnterior({ de: '2026-09-18', ate: '2026-09-24' }), { de: '2026-09-11', ate: '2026-09-17' });
    assert.deepStrictEqual(F.periodoAnterior({ de: '2026-09-24', ate: '2026-09-24' }), { de: '2026-09-23', ate: '2026-09-23' });
    assert.deepStrictEqual(F.periodoAnterior({ de: '2026-03-01', ate: '2026-03-02' }), { de: '2026-02-27', ate: '2026-02-28' });
});
test('variacao: pct para contagens, pontos para taxas, null sem base', () => {
    assert.strictEqual(F.variacao(12, 10), 20);
    assert.strictEqual(F.variacao(5, 10), -50);
    assert.strictEqual(F.variacao(3, 0), null);
    assert.strictEqual(F.variacao(0, 0), 0);
    assert.strictEqual(F.variacao(null, 4), null);
    assert.strictEqual(F.variacao(0.6, 0.5, 'pontos'), 10);
    assert.strictEqual(F.variacao(null, 0.5, 'pontos'), null);
});
test('formatarVariacao', () => {
    assert.strictEqual(F.formatarVariacao(12.345), '12,3%');
    assert.strictEqual(F.formatarVariacao(-4), '4%');
    assert.strictEqual(F.formatarVariacao(2.5, 'pontos'), '2,5 p.p.');
    assert.strictEqual(F.formatarVariacao(null), '—');
});
test('escalaMax: teto "redondo" para o eixo do grafico', () => {
    assert.strictEqual(F.escalaMax(0), 4);
    assert.strictEqual(F.escalaMax(3), 4);
    assert.strictEqual(F.escalaMax(14), 20);
    assert.strictEqual(F.escalaMax(37), 40);
    assert.strictEqual(F.escalaMax(230), 250);
});
test('formatarMoeda e formatarHoras', () => {
    assert.strictEqual(F.formatarMoeda(1234.56).replace(/\s/g, ' '), 'R$ 1.234,56');
    assert.strictEqual(F.formatarMoeda(0).replace(/\s/g, ' '), 'R$ 0,00');
    assert.strictEqual(F.formatarMoeda(null), '—');
    assert.strictEqual(F.formatarHoras(12.44), '12,4 h');
    assert.strictEqual(F.formatarHoras(0.5), '30 min');
    assert.strictEqual(F.formatarHoras(0), '0 min');
    assert.strictEqual(F.formatarHoras(null), '—');
});
