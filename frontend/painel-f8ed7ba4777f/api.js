(function () {
    const URL_API = 'https://n8n.amais.io/webhook/painel-api';
    const CHAVE = 'painelSessao';
    let timerRefresh = null;

    function lerSessao() { try { return JSON.parse(sessionStorage.getItem(CHAVE)); } catch (e) { return null; } }
    function salvarSessao(s) { try { sessionStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) {} agendarRefresh(s); }
    function limparSessao() { try { sessionStorage.removeItem(CHAVE); } catch (e) {} clearTimeout(timerRefresh); }

    async function chamar(acao, dados, comToken = true) {
        const s = lerSessao();
        const headers = { 'Content-Type': 'application/json' };
        if (comToken && s && s.access_token) headers.Authorization = 'Bearer ' + s.access_token;
        let resp;
        try {
            resp = await fetch(URL_API, { method: 'POST', headers, body: JSON.stringify(Object.assign({ acao }, dados || {})) });
        } catch (e) {
            throw new Error('Não foi possível falar com o servidor. Tente de novo.');
        }
        let corpo = {};
        try { corpo = await resp.json(); } catch (e) { corpo = {}; }
        if (resp.status === 401 && comToken) { limparSessao(); window.dispatchEvent(new Event('painel:sessao-expirada')); }
        if (!resp.ok || corpo.ok === false) {
            const msg = corpo.erro === 'sessao_expirada' ? 'Sua sessão expirou. Entre de novo.' : (corpo.erro || 'Não foi possível concluir. Tente de novo.');
            const err = new Error(msg); err.status = resp.status; throw err;
        }
        return corpo;
    }

    function agendarRefresh(s) {
        clearTimeout(timerRefresh);
        if (!s || !s.expires_at) return;
        const emMs = s.expires_at * 1000 - Date.now() - 60000;
        timerRefresh = setTimeout(async () => {
            try { const n = await chamar('refresh', { refresh_token: s.refresh_token }, false); salvarSessao(n); }
            catch (e) { limparSessao(); window.dispatchEvent(new Event('painel:sessao-expirada')); }
        }, Math.max(emMs, 5000));
    }

    async function entrar(email, senha) { const s = await chamar('login', { email, senha }, false); salvarSessao(s); return s; }
    function sair() { limparSessao(); }

    window.PainelApi = { chamar, entrar, sair, lerSessao, agendarRefresh };
})();
