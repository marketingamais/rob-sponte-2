(function () {
    const F = window.Formatos, API = window.PainelApi;
    const $ = (id) => document.getElementById(id);
    let grafico = null, usuarioAtual = null, periodo = null;
    const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3500); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    function mostrarLogin(msg) {
        $('app').hidden = true; $('telaLogin').hidden = false;
        if (msg) { $('loginErro').textContent = msg; $('loginErro').hidden = false; }
    }
    function mostrarApp(usuario) {
        usuarioAtual = usuario;
        $('telaLogin').hidden = true; $('app').hidden = false;
        $('usuarioNome').textContent = usuario.nome || usuario.email;
        $('usuarioPapel').textContent = usuario.papel === 'super_admin' ? 'Super administrador' : 'Membro';
        $('navUsuarios').hidden = usuario.papel !== 'super_admin';
        irPara('dashboard');
    }
    function irPara(view) {
        if (view === 'usuarios' && usuarioAtual.papel !== 'super_admin') view = 'dashboard';
        for (const v of ['dashboard', 'usuarios', 'conta']) $('view' + v[0].toUpperCase() + v.slice(1)).hidden = v !== view;
        document.querySelectorAll('nav [data-view]').forEach(b => b.classList.toggle('ativo', b.dataset.view === view));
        if (view === 'dashboard') carregarDashboard();
        if (view === 'usuarios') carregarUsuarios();
    }

    // ---------- Login ----------
    $('formLogin').addEventListener('submit', async (e) => {
        e.preventDefault();
        $('loginErro').hidden = true; $('btnEntrar').disabled = true;
        try { const s = await API.entrar($('loginEmail').value.trim(), $('loginSenha').value); $('loginSenha').value = ''; mostrarApp(s.usuario); }
        catch (err) { $('loginErro').textContent = err.message; $('loginErro').hidden = false; }
        finally { $('btnEntrar').disabled = false; }
    });
    $('btnSair').addEventListener('click', () => { API.sair(); mostrarLogin(); });
    window.addEventListener('painel:sessao-expirada', () => mostrarLogin('Sua sessão expirou. Entre de novo.'));
    document.querySelectorAll('nav [data-view]').forEach(b => b.addEventListener('click', () => irPara(b.dataset.view)));

    // ---------- Dashboard ----------
    function definirPeriodo(p) { periodo = p; $('periodoDe').value = p.de; $('periodoAte').value = p.ate; }
    document.querySelectorAll('[data-periodo]').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('[data-periodo]').forEach(x => x.classList.toggle('ativo', x === b));
        definirPeriodo(F.periodoPreset(b.dataset.periodo, hojeSP())); carregarDashboard();
    }));
    $('btnAplicarPeriodo').addEventListener('click', () => {
        const de = $('periodoDe').value, ate = $('periodoAte').value;
        if (!de || !ate || de > ate) { toast('Escolha um período válido.'); return; }
        document.querySelectorAll('[data-periodo]').forEach(x => x.classList.remove('ativo'));
        definirPeriodo({ de, ate }); carregarDashboard();
    });

    function card(id, valor, sub) { $(id).querySelector('.card-valor').textContent = valor; $(id).querySelector('.card-sub').textContent = sub || ''; }

    async function carregarDashboard() {
        if (!periodo) definirPeriodo(F.periodoPreset('7d', hojeSP()));
        $('dashboardErro').hidden = true;
        document.body.classList.add('carregando');
        try {
            const r = await API.chamar('dashboard', periodo);
            const d = r.dashboard;
            card('cardConsultas', F.formatarNumero(d.total), `${F.formatarDia(d.periodo.de)} a ${F.formatarDia(d.periodo.ate)}`);
            card('cardDebito', F.formatarNumero(d.debito), 'linha digitável de parcela vencida');
            card('cardEncaminhamentos', F.formatarNumero(d.encaminhamento), 'mais de 5 dias de atraso');
            card('cardResolucao', F.formatarPct(d.taxaResolucao),
                `em dia c/ boleto: ${F.formatarNumero(d.emDiaBoleto)} · sem boleto: ${F.formatarNumero(d.emDiaSemBoleto + d.atrasadoSemLinha)}`);
            card('cardErros', F.formatarPct(d.taxaErros), `${F.formatarNumero(d.erros)} consultas com erro`);
            $('listaErrosTela').innerHTML = d.errosPorTela.length
                ? d.errosPorTela.map(e => `<li><span>${esc(e.tela)}</span><strong>${F.formatarNumero(e.qtd)}</strong><em>${F.formatarPct(e.pct)}</em></li>`).join('')
                : '<li class="vazio">Nenhum erro no período.</li>';
            $('saude').innerHTML = r.saude.map(s => `<li><span class="nivel nivel-${esc(s.nivel)}" aria-label="${esc(s.nivel)}"></span><strong>${esc(s.item)}</strong><span>${esc(s.detalhe)}</span></li>`).join('');
            const origem = Object.entries(d.porOrigem).map(([k, v]) => `${({ cache: 'cache', cache_antigo: 'cache antigo', ao_vivo: 'ao vivo', sem_dados: 'sem dados', navegador: 'navegador' })[k] || k}: ${F.formatarNumero(v)}`).join(' · ');
            $('infoApoio').textContent = `Tempo médio de resposta: ${F.formatarDuracao(d.tempoMedioMs)}${origem ? ' · ' + origem : ''}`;
            if (r.planilhaUrl) { $('linkPlanilha').href = r.planilhaUrl; $('linkPlanilha').hidden = false; }
            desenharGrafico(d.porDia);
        } catch (err) {
            $('dashboardErro').textContent = err.message; $('dashboardErro').hidden = false;
        } finally { document.body.classList.remove('carregando'); }
    }

    function desenharGrafico(porDia) {
        const dados = { labels: porDia.map(p => F.formatarDia(p.dia)), datasets: [
            { label: 'Resolvidas', data: porDia.map(p => p.resolvidas), backgroundColor: '#1f9d55', stack: 's' },
            { label: 'Erros', data: porDia.map(p => p.erros), backgroundColor: '#d64545', stack: 's' }] };
        if (typeof Chart === 'undefined') return;
        if (grafico) { grafico.data = dados; grafico.update(); return; }
        grafico = new Chart($('graficoDias'), { type: 'bar', data: dados,
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } } });
    }

    // ---------- Usuarios ----------
    let usuarios = [];
    async function carregarUsuarios() {
        $('usuariosErro').hidden = true;
        try { usuarios = (await API.chamar('usuarios_listar')).usuarios; desenharUsuarios(); }
        catch (err) { $('usuariosErro').textContent = err.message; $('usuariosErro').hidden = false; }
    }
    function desenharUsuarios() {
        const eu = usuarioAtual.email;
        $('tabelaUsuarios').querySelector('tbody').innerHTML = usuarios.map(u => {
            const proprio = u.email === eu;
            const acoes = proprio ? '<em>você</em>' : `
                <button data-acao="papel" data-email="${esc(u.email)}">${u.papel === 'super_admin' ? 'Tornar membro' : 'Tornar super admin'}</button>
                <button data-acao="ativo" data-email="${esc(u.email)}">${u.ativo ? 'Desativar' : 'Reativar'}</button>
                <button data-acao="senha" data-email="${esc(u.email)}">Redefinir senha</button>
                <button data-acao="remover" data-email="${esc(u.email)}" class="perigo">Remover</button>`;
            return `<tr><td>${esc(u.nome)}</td><td>${esc(u.email)}</td><td>${u.papel === 'super_admin' ? 'Super admin' : 'Membro'}</td>
                <td>${u.ativo ? 'Ativo' : 'Inativo'}</td><td class="acoes">${acoes}</td></tr>`;
        }).join('');
    }
    function confirmar(texto) {
        return new Promise(res => {
            $('confirmarTexto').textContent = texto; const d = $('dlgConfirmar');
            const fim = (v) => { d.close(); $('btnConfirmarSim').onclick = $('btnConfirmarNao').onclick = null; res(v); };
            $('btnConfirmarSim').onclick = () => fim(true); $('btnConfirmarNao').onclick = () => fim(false); d.showModal();
        });
    }
    async function acaoUsuario(acao, dados, ok) {
        try { await API.chamar(acao, dados); toast(ok); await carregarUsuarios(); }
        catch (err) { toast(err.message); }
    }
    $('tabelaUsuarios').addEventListener('click', async (e) => {
        const b = e.target.closest('button[data-acao]'); if (!b) return;
        const u = usuarios.find(x => x.email === b.dataset.email); if (!u) return;
        if (b.dataset.acao === 'papel') {
            const papel = u.papel === 'super_admin' ? 'membro' : 'super_admin';
            if (await confirmar(`${papel === 'super_admin' ? 'Tornar' : 'Rebaixar'} ${u.nome} ${papel === 'super_admin' ? 'super administrador' : 'para membro'}?`))
                acaoUsuario('usuarios_atualizar', { email: u.email, papel }, 'Papel atualizado.');
        } else if (b.dataset.acao === 'ativo') {
            if (await confirmar(`${u.ativo ? 'Desativar' : 'Reativar'} ${u.nome}?`))
                acaoUsuario('usuarios_atualizar', { email: u.email, ativo: !u.ativo }, u.ativo ? 'Usuário desativado.' : 'Usuário reativado.');
        } else if (b.dataset.acao === 'senha') {
            const senha = F.gerarSenha();
            if (await confirmar(`Nova senha provisória para ${u.nome}: ${senha}\nCopie antes de confirmar.`)) {
                try { await navigator.clipboard.writeText(senha); } catch (err) {}
                acaoUsuario('usuarios_redefinir_senha', { email: u.email, senha }, 'Senha redefinida (copiada).');
            }
        } else if (b.dataset.acao === 'remover') {
            if (await confirmar(`Remover ${u.nome} (${u.email})? Essa ação não pode ser desfeita.`))
                acaoUsuario('usuarios_remover', { email: u.email }, 'Usuário removido.');
        }
    });
    $('btnNovoUsuario').addEventListener('click', () => {
        $('formUsuario').reset(); $('uSenha').value = F.gerarSenha(); $('uErro').hidden = true; $('dlgUsuario').showModal();
    });
    $('btnGerarSenha').addEventListener('click', () => { $('uSenha').value = F.gerarSenha(); });
    $('btnCopiarSenha').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('uSenha').value); toast('Senha copiada.'); } catch (e) { toast('Copie a senha manualmente.'); } });
    $('formUsuario').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (e.submitter && e.submitter.value === 'cancelar') { $('dlgUsuario').close(); return; }
        $('uErro').hidden = true;
        try {
            await API.chamar('usuarios_criar', { nome: $('uNome').value.trim(), email: $('uEmail').value.trim(), papel: $('uPapel').value, senha: $('uSenha').value });
            $('dlgUsuario').close(); toast('Usuário criado. Envie a senha provisória a ele.'); carregarUsuarios();
        } catch (err) { $('uErro').textContent = err.message; $('uErro').hidden = false; }
    });

    // ---------- Minha conta ----------
    $('formSenha').addEventListener('submit', async (e) => {
        e.preventDefault();
        const a = $('senhaNova').value, b = $('senhaNova2').value;
        const msg = $('contaMsg');
        if (a !== b) { msg.textContent = 'As senhas não conferem.'; return; }
        try { await API.chamar('trocar_senha', { senha_nova: a }); msg.textContent = 'Senha alterada.'; $('formSenha').reset(); }
        catch (err) { msg.textContent = err.message; }
    });

    // ---------- Inicio ----------
    (async function iniciar() {
        const s = API.lerSessao();
        if (!s || !s.access_token) return mostrarLogin();
        API.agendarRefresh(s);
        try { const r = await API.chamar('eu'); mostrarApp(r.usuario); } catch (e) { mostrarLogin(); }
    })();
})();
