(function (raiz) {
    const nf = new Intl.NumberFormat('pt-BR');
    function formatarNumero(n) { return nf.format(Number(n) || 0); }
    function formatarPct(x) {
        if (x === null || x === undefined || Number.isNaN(Number(x))) return '—';
        return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Number(x) * 100) + '%';
    }
    function formatarDuracao(ms) {
        if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '—';
        const s = Number(ms) / 1000;
        if (s < 60) return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(s) + ' s';
        return Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s';
    }
    function formatarDia(d) { const [, m, dia] = String(d).split('-'); return dia + '/' + m; }
    function menosDias(aaaaMmDd, n) {
        const d = new Date(aaaaMmDd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
    }
    function periodoPreset(nome, hoje) {
        if (nome === 'hoje') return { de: hoje, ate: hoje };
        if (nome === '30d') return { de: menosDias(hoje, 29), ate: hoje };
        return { de: menosDias(hoje, 6), ate: hoje };
    }
    // Mesmo número de dias, terminando na véspera de `de` (base dos "vs período anterior")
    function periodoAnterior(p) {
        const dias = Math.round((Date.parse(p.ate + 'T12:00:00Z') - Date.parse(p.de + 'T12:00:00Z')) / 86400000);
        const ate = menosDias(p.de, 1);
        return { de: menosDias(ate, dias), ate };
    }
    // Contagens: variação %; taxas (0..1): diferença em pontos percentuais. null quando não dá para comparar.
    function variacao(atual, anterior, tipo) {
        if (atual === null || atual === undefined || anterior === null || anterior === undefined) return null;
        if (tipo === 'pontos') return Math.round((atual - anterior) * 1000) / 10;
        if (!anterior) return atual ? null : 0;
        return ((atual - anterior) / anterior) * 100;
    }
    function formatarVariacao(v, tipo) {
        if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
        const n = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Math.abs(v));
        return tipo === 'pontos' ? n + ' p.p.' : n + '%';
    }
    // Teto "redondo" do eixo Y (sequência 1-2-2,5-4-5-8 x 10^k), mínimo 4
    function escalaMax(max) {
        if (!(max > 4)) return 4;
        const pot = Math.pow(10, Math.floor(Math.log10(max)));
        for (const m of [1, 2, 2.5, 4, 5, 8, 10]) if (m * pot >= max) return m * pot;
        return 10 * pot;
    }
    function formatarMoeda(n) {
        if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));
    }
    // Horas com 1 casa; abaixo de 1 h mostra em minutos
    function formatarHoras(h) {
        if (h === null || h === undefined || Number.isNaN(Number(h))) return '—';
        if (h < 1) return Math.round(h * 60) + ' min';
        return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(h) + ' h';
    }
    function gerarSenha() {
        const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        const c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : require('crypto').webcrypto;
        const b = new Uint32Array(14); c.getRandomValues(b);
        return Array.from(b, x => A[x % A.length]).join('');
    }
    const api = { formatarNumero, formatarPct, formatarDuracao, formatarDia, periodoPreset, gerarSenha,
        periodoAnterior, variacao, formatarVariacao, escalaMax, formatarMoeda, formatarHoras };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.Formatos = api;
})(typeof window !== 'undefined' ? window : globalThis);
