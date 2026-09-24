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
    function gerarSenha() {
        const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        const c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : require('crypto').webcrypto;
        const b = new Uint32Array(14); c.getRandomValues(b);
        return Array.from(b, x => A[x % A.length]).join('');
    }
    const api = { formatarNumero, formatarPct, formatarDuracao, formatarDia, periodoPreset, gerarSenha };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.Formatos = api;
})(typeof window !== 'undefined' ? window : globalThis);
