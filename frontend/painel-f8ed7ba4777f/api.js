(function () {
    const URL_API = 'https://n8n.amais.io/webhook/painel-api';
    const CHAVE = 'painelSessao';
    let timerRefresh = null;
    let geracaoSessao = 0, refreshEmCurso = null;
    const LEITURAS = new Set(['dashboard', 'eu', 'usuarios_listar', 'kpis_padrao_ler']);

    function lerSessao() { try { return JSON.parse(sessionStorage.getItem(CHAVE)); } catch (e) { return null; } }
    function salvarSessao(s) { try { sessionStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) {} agendarRefresh(s); }
    function limparSessao() {
        geracaoSessao++; refreshEmCurso = null;
        try { sessionStorage.removeItem(CHAVE); } catch (e) {}
        clearTimeout(timerRefresh);
    }
    function sessaoAlterada() { const e = new Error('A sessão mudou. Tente novamente.'); e.sessaoAlterada = true; return e; }
    function conferirGeracao(g) { if (g !== geracaoSessao) throw sessaoAlterada(); }
    function expirarSessao(s, g) {
        const atual = lerSessao();
        if (g !== geracaoSessao || !s || !atual || s.access_token !== atual.access_token || s.refresh_token !== atual.refresh_token) return;
        limparSessao(); window.dispatchEvent(new Event('painel:sessao-expirada'));
    }

    async function enviar(acao, dados, s) {
        const headers = { 'Content-Type': 'application/json' };
        if (s && s.access_token) headers.Authorization = 'Bearer ' + s.access_token;
        let resp;
        try {
            resp = await fetch(URL_API, { method: 'POST', headers, body: JSON.stringify(Object.assign({ acao }, dados || {})) });
        } catch (e) {
            throw new Error('Não foi possível falar com o servidor. Tente de novo.');
        }
        let corpo = {};
        try { corpo = (await resp.json()) || {}; } catch (e) { corpo = {}; }
        if (!resp.ok || !corpo || corpo.ok !== true) {
            const msg = corpo.erro === 'sessao_expirada' ? 'Sua sessão expirou. Entre de novo.' : (corpo.erro || 'Não foi possível concluir. Tente de novo.');
            const err = new Error(msg); err.status = resp.status;
            err.sessaoExpirada = resp.status === 401 && corpo.erro === 'sessao_expirada';
            throw err;
        }
        return corpo;
    }

    async function renovarSessao(g) {
        conferirGeracao(g);
        if (refreshEmCurso && refreshEmCurso.geracao === g) return refreshEmCurso.promessa;
        const s = lerSessao();
        if (!s || !s.refresh_token) { expirarSessao(s, g); throw new Error('Sua sessão expirou. Entre de novo.'); }
        clearTimeout(timerRefresh);
        const operacao = { geracao: g, promessa: null };
        refreshEmCurso = operacao;
        operacao.promessa = (async () => {
            try {
                const n = await enviar('refresh', { refresh_token: s.refresh_token });
                conferirGeracao(g);
                if (!n.access_token || !n.refresh_token) throw new Error('Não foi possível renovar a sessão. Tente novamente.');
                salvarSessao(n); return n;
            } catch (e) {
                conferirGeracao(g);
                if (e.sessaoExpirada) expirarSessao(s, g);
                else agendarRefresh(s, 30000);
                throw e;
            } finally {
                if (refreshEmCurso === operacao) refreshEmCurso = null;
            }
        })();
        return operacao.promessa;
    }

    async function chamar(acao, dados, comToken = true) {
        const g = geracaoSessao;
        const inicial = lerSessao();
        if (comToken && inicial && inicial.refresh_token && inicial.expires_at && inicial.expires_at * 1000 <= Date.now() + 60000) await renovarSessao(g);
        for (let tentativa = 0; ; tentativa++) {
            conferirGeracao(g);
            const s = comToken ? lerSessao() : null;
            try {
                const r = await enviar(acao, dados, s);
                conferirGeracao(g); return r;
            } catch (e) {
                conferirGeracao(g);
                if (!comToken || !e.sessaoExpirada) throw e;
                const atual = lerSessao();
                const mesmoToken = s && atual && s.access_token === atual.access_token;
                if (tentativa > 0) { if (mesmoToken) expirarSessao(s, g); throw e; }
                if (mesmoToken) await renovarSessao(g);
                if (!LEITURAS.has(acao)) throw new Error('A sessão foi renovada. Tente a ação novamente.');
                // Somente consultas podem repetir; uma escrita nunca é reenviada automaticamente.
            }
        }
    }

    function agendarRefresh(s, atraso) {
        clearTimeout(timerRefresh);
        if (!s || !s.refresh_token || (!s.expires_at && atraso === undefined)) return;
        const g = geracaoSessao;
        const emMs = s.expires_at * 1000 - Date.now() - 60000;
        timerRefresh = setTimeout(async () => {
            if (g !== geracaoSessao) return;
            try { await renovarSessao(g); } catch (e) { /* A renovação preserva a sessão em falhas transitórias. */ }
        }, atraso === undefined ? Math.max(emMs, 5000) : atraso);
    }

    async function entrar(email, senha) {
        limparSessao(); const g = geracaoSessao;
        const s = await chamar('login', { email, senha }, false);
        conferirGeracao(g);
        if (!s.access_token || !s.refresh_token) throw new Error('Não foi possível entrar. Tente novamente.');
        salvarSessao(s); return s;
    }
    function sair() { limparSessao(); }

    window.PainelApi = { chamar, entrar, sair, lerSessao, agendarRefresh };
})();
