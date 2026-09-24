(function () {
    const F = window.Formatos, API = window.PainelApi, G = window.Graficos;
    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);
    let usuarioAtual = null, periodo = null, verSaudeDetalhe = false, carregamento = 0;
    const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
    const ler = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

    function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3500); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function iniciais(nome) {
        const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
        return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
    }
    const nomePapel = (p) => p === 'super_admin' ? 'Super administrador' : 'Membro';

    // ---------- Sessão / telas ----------
    function mostrarLogin(msg) {
        $('app').hidden = true; $('telaLogin').hidden = false;
        if (msg) { $('loginErro').textContent = msg; $('loginErro').hidden = false; }
    }
    function mostrarApp(usuario) {
        usuarioAtual = usuario;
        $('telaLogin').hidden = true; $('app').hidden = false;
        const nome = usuario.nome || usuario.email;
        $$('[data-iniciais]').forEach(e => { e.textContent = iniciais(nome); });
        $('usuarioNome').textContent = nome; $('usuarioEmail').textContent = usuario.email || '';
        $('usuarioPapel').textContent = nomePapel(usuario.papel);
        $('contaNome').textContent = nome; $('contaEmail').textContent = usuario.email || '';
        $('contaPapel').textContent = nomePapel(usuario.papel);
        $('grupoAdmin').hidden = usuario.papel !== 'super_admin';
        irPara('dashboard');
    }

    const VIEWS = {
        dashboard: { titulo: 'Dashboard', icone: 'ti-layout-grid' },
        usuarios: { titulo: 'Usuários', icone: 'ti-users' },
        conta: { titulo: 'Minha conta', icone: 'ti-user-circle' }
    };
    function irPara(view) {
        if (view === 'usuarios' && usuarioAtual.papel !== 'super_admin') view = 'dashboard';
        for (const v of Object.keys(VIEWS)) $('view' + v[0].toUpperCase() + v.slice(1)).hidden = v !== view;
        $$('.sb-item[data-view]').forEach(b => b.classList.toggle('ativo', b.dataset.view === view));
        $('migalhaTitulo').textContent = VIEWS[view].titulo;
        $('migalhaIcone').className = 'ti ' + VIEWS[view].icone;
        fecharMenu(); fecharGaveta();
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
    $$('[data-sair]').forEach(b => b.addEventListener('click', () => { API.sair(); fecharMenu(); mostrarLogin(); }));
    window.addEventListener('painel:sessao-expirada', () => mostrarLogin('Sua sessão expirou. Entre de novo.'));
    $$('[data-view]').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); irPara(b.dataset.view); }));

    // ---------- Sidebar (recolher no desktop, gaveta no celular) ----------
    const celular = () => window.matchMedia('(max-width: 767px)').matches;
    function aplicarSidebar(estado) {
        $('app').dataset.sidebar = estado;
        const recolhida = estado === 'recolhida';
        $('btnSidebar').setAttribute('aria-label', recolhida ? 'Expandir menu' : 'Recolher menu');
        $('btnSidebar').title = (recolhida ? 'Expandir menu' : 'Recolher menu') + ' (Ctrl+B)';
    }
    function abrirGaveta() { $('app').classList.add('sb-aberta'); $('sbFundo').hidden = false; }
    function fecharGaveta() { $('app').classList.remove('sb-aberta'); $('sbFundo').hidden = true; }
    function alternarSidebar() {
        if (celular()) { $('app').classList.contains('sb-aberta') ? fecharGaveta() : abrirGaveta(); return; }
        const novo = $('app').dataset.sidebar === 'recolhida' ? 'expandida' : 'recolhida';
        aplicarSidebar(novo); guardar('painelSidebar', novo);
    }
    aplicarSidebar(ler('painelSidebar') === 'recolhida' ? 'recolhida' : 'expandida');
    $('btnSidebar').addEventListener('click', alternarSidebar);
    $('sbFundo').addEventListener('click', fecharGaveta);
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !$('app').hidden) { e.preventDefault(); alternarSidebar(); }
        if (e.key === 'Escape') { fecharMenu(); fecharGaveta(); }
    });
    // Dica (tooltip) dos itens quando a sidebar está recolhida
    $('sidebar').addEventListener('mouseover', (e) => {
        const alvo = e.target.closest('[data-dica]');
        if (!alvo || $('app').dataset.sidebar !== 'recolhida' || celular()) return;
        const r = alvo.getBoundingClientRect(), d = $('dica');
        d.textContent = alvo.dataset.dica; d.hidden = false;
        d.style.left = (r.right + 8) + 'px'; d.style.top = (r.top + r.height / 2 - d.offsetHeight / 2) + 'px';
    });
    $('sidebar').addEventListener('mouseout', () => { $('dica').hidden = true; });

    // ---------- Menu do usuário ----------
    function fecharMenu() { $('menuUsuario').hidden = true; $('btnAvatar').setAttribute('aria-expanded', 'false'); }
    $('btnAvatar').addEventListener('click', (e) => {
        e.stopPropagation();
        const abrir = $('menuUsuario').hidden;
        $('menuUsuario').hidden = !abrir; $('btnAvatar').setAttribute('aria-expanded', String(abrir));
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.menu-usuario')) fecharMenu(); });

    // ---------- Aviso do último export (sidebar) ----------
    $('btnFecharExport').addEventListener('click', () => { $('ultimoExport').hidden = true; try { sessionStorage.setItem('painelExportFechado', '1'); } catch (e) {} });
    function exportFechado() { try { return sessionStorage.getItem('painelExportFechado') === '1'; } catch (e) { return false; } }

    // ---------- Dashboard ----------
    function definirPeriodo(p) { periodo = p; $('periodoDe').value = p.de; $('periodoAte').value = p.ate; }
    $$('[data-periodo]').forEach(b => b.addEventListener('click', () => {
        $$('[data-periodo]').forEach(x => x.classList.toggle('ativo', x === b));
        definirPeriodo(F.periodoPreset(b.dataset.periodo, hojeSP())); carregarDashboard();
    }));
    $('btnAplicarPeriodo').addEventListener('click', () => {
        const de = $('periodoDe').value, ate = $('periodoAte').value;
        if (!de || !ate || de > ate) { toast('Escolha um período válido.'); return; }
        $$('[data-periodo]').forEach(x => x.classList.remove('ativo'));
        definirPeriodo({ de, ate }); carregarDashboard();
    });
    $('btnAtualizar').addEventListener('click', () => {
        if (!$('viewDashboard').hidden) carregarDashboard();
        else if (!$('viewUsuarios').hidden) carregarUsuarios();
    });
    $('btnVerSaude').addEventListener('click', () => { verSaudeDetalhe = true; $('saudeVazio').hidden = true; $('saude').hidden = false; });

    // Delta: sentido 'bom' (subir = verde), 'ruim' (subir = vermelho) ou 'neutro'
    function pintarDelta(alvo, v, tipo, sentido, selo) {
        alvo.className = 'delta' + (selo ? ' delta-selo' : '');
        if (v === null || v === undefined) { alvo.innerHTML = '<i class="ti ti-minus" aria-hidden="true"></i><span>—</span>'; return; }
        const bom = (v > 0 && sentido === 'bom') || (v < 0 && sentido === 'ruim');
        const ruim = (v < 0 && sentido === 'bom') || (v > 0 && sentido === 'ruim');
        if (bom) alvo.classList.add('sobe'); else if (ruim) alvo.classList.add('desce');
        const icone = v === 0 ? 'ti-minus' : selo ? (v > 0 ? 'ti-trending-up' : 'ti-trending-down') : (v > 0 ? 'ti-chevron-up' : 'ti-chevron-down');
        alvo.innerHTML = `<i class="ti ${icone}" aria-hidden="true"></i><span>${F.formatarVariacao(v, tipo)}</span>`;
        alvo.title = (v > 0 ? 'Subiu ' : v < 0 ? 'Caiu ' : 'Igual: ') + F.formatarVariacao(v, tipo) + ' em relação ao período anterior';
    }
    function stat(id, valor, v, tipo, sentido, temBase) {
        const c = $(id);
        c.querySelector('[data-valor]').textContent = valor;
        const d = c.querySelector('[data-delta]');
        if (temBase) { d.hidden = false; pintarDelta(d, v, tipo, sentido, false); c.querySelector('[data-pe]').textContent = 'vs período anterior'; }
        else { d.hidden = true; c.querySelector('[data-pe]').textContent = 'sem período anterior para comparar'; }
    }
    function esqueleto() {
        $('grade').classList.add('carregando');
        $$('.stat [data-valor]').forEach(e => { e.innerHTML = '<span class="esqueleto" style="width:4.5rem;height:1.75rem"></span>'; });
    }

    const ORIGENS = {
        cache: { icone: 'ti-database', titulo: 'Cache do dia', sub: 'Resposta imediata do banco' },
        cache_antigo: { icone: 'ti-history', titulo: 'Cache anterior', sub: 'Robô fora do ar; usamos o último dado' },
        ao_vivo: { icone: 'ti-robot', titulo: 'Robô ao vivo', sub: 'Consulta direta na Sponte' },
        navegador: { icone: 'ti-world', titulo: 'Erro no navegador', sub: 'CPF inválido ou tempo esgotado' },
        sem_dados: { icone: 'ti-circle-off', titulo: 'Sem dados', sub: 'CPF não encontrado ou inválido' }
    };

    async function carregarDashboard() {
        if (!periodo) definirPeriodo(F.periodoPreset('7d', hojeSP()));
        const meu = ++carregamento;
        $('dashboardErro').hidden = true;
        esqueleto();
        const [atual, anterior] = await Promise.allSettled([
            API.chamar('dashboard', periodo),
            API.chamar('dashboard', F.periodoAnterior(periodo))
        ]);
        if (meu !== carregamento) return; // outro carregamento começou depois
        $('grade').classList.remove('carregando');
        if (atual.status !== 'fulfilled') {
            $('dashboardErro').textContent = atual.reason.message; $('dashboardErro').hidden = false;
            $$('.stat [data-valor]').forEach(e => { e.textContent = '—'; });
            return;
        }
        desenharDashboard(atual.value, anterior.status === 'fulfilled' ? anterior.value.dashboard : null);
    }

    function desenharDashboard(r, ant) {
        const d = r.dashboard, base = !!(ant && ant.total);
        $('periodoTexto').textContent = `Consultas de boletos de ${F.formatarDia(d.periodo.de)} a ${F.formatarDia(d.periodo.ate)}.`;

        // KPIs
        stat('statConsultas', F.formatarNumero(d.total), base ? F.variacao(d.total, ant.total) : null, 'pct', 'bom', base);
        stat('statDebito', F.formatarNumero(d.debito), base ? F.variacao(d.debito, ant.debito) : null, 'pct', 'neutro', base);
        stat('statEncaminhamentos', F.formatarNumero(d.encaminhamento), base ? F.variacao(d.encaminhamento, ant.encaminhamento) : null, 'pct', 'neutro', base);
        stat('statResolucao', F.formatarPct(d.taxaResolucao), base ? F.variacao(d.taxaResolucao, ant.taxaResolucao, 'pontos') : null, 'pontos', 'bom', base);
        $('dicaResolucao').title = `Consultas que não terminaram em pop-up de erro. Em dia com boleto: ${F.formatarNumero(d.emDiaBoleto)} · sem boleto: ${F.formatarNumero(d.emDiaSemBoleto + d.atrasadoSemLinha)}.`;

        // Selos dos gráficos
        const sc = $('seloConsultas'), se = $('seloErros');
        sc.hidden = !base; if (base) pintarDelta(sc, F.variacao(d.total, ant.total), 'pct', 'bom', true);
        se.hidden = !base; if (base) pintarDelta(se, F.variacao(d.taxaErros, ant.taxaErros, 'pontos'), 'pontos', 'ruim', true);
        $('taxaErrosTexto').textContent = d.total ? `· ${F.formatarPct(d.taxaErros)} com erro (${F.formatarNumero(d.erros)})` : '';

        // Gráficos
        const dias = d.porDia.map(p => ({ rotulo: F.formatarDia(p.dia), titulo: F.formatarDia(p.dia), valor: p.resolvidas + p.erros, valores: { resolvidas: p.resolvidas, erros: p.erros } }));
        G.barras($('graficoBarras'), dias, { nome: 'Consultas', cor: 'var(--chart-1)' }, { vazio: 'Sem consultas no período.', formatar: F.formatarNumero });
        G.degraus($('graficoLinhas'), dias, [
            { chave: 'resolvidas', nome: 'Resolvidas', cor: 'var(--chart-1)' },
            { chave: 'erros', nome: 'Erros', cor: 'var(--chart-2)' }
        ], { vazio: 'Sem consultas no período.', formatar: F.formatarNumero });

        // Erros por tela
        $('listaErrosTela').innerHTML = d.errosPorTela.length
            ? d.errosPorTela.map(e => `<tr><td class="ps-6 forte">${esc(e.tela)}</td><td class="num">${F.formatarNumero(e.qtd)}</td><td class="num pe-6 texto-suave">${F.formatarPct(e.pct)}</td></tr>`).join('')
            : '<tr class="vazio-linha"><td colspan="3">Nenhum erro no período.</td></tr>';
        $('cardErrosTela').classList.toggle('com-fade', d.errosPorTela.length > 3);

        // Saúde
        const ruins = r.saude.filter(s => s.nivel !== 'verde');
        $('saudeResumo').textContent = ruins.length ? `${ruins.length} ${ruins.length === 1 ? 'item precisa' : 'itens precisam'} da sua atenção.` : 'Nada urgente precisa da sua atenção.';
        const ordenados = ruins.concat(r.saude.filter(s => s.nivel === 'verde'));
        $('saude').innerHTML = ordenados.map(s => `<li><span class="nivel nivel-${esc(s.nivel)}" aria-label="${esc(s.nivel)}"></span><div class="saude-texto"><p class="saude-item">${esc(s.item)}</p><p class="saude-detalhe">${esc(s.detalhe)}</p></div></li>`).join('');
        const tudoVerde = !ruins.length && !verSaudeDetalhe;
        $('saudeVazio').hidden = !tudoVerde; $('saude').hidden = tudoVerde;

        // Origem das respostas
        const origens = Object.entries(d.porOrigem).sort((a, b) => b[1] - a[1]);
        const total = origens.reduce((s, [, v]) => s + v, 0);
        $('listaOrigem').innerHTML = origens.length ? origens.slice(0, 4).map(([k, v]) => {
            const o = ORIGENS[k] || { icone: 'ti-point', titulo: k, sub: '' };
            return `<li><span class="atividade-icone" aria-hidden="true"><i class="ti ${o.icone}"></i></span>
                <div class="atividade-texto"><p class="atividade-titulo">${esc(o.titulo)}</p><p class="atividade-sub">${esc(o.sub)}</p></div>
                <span class="atividade-qtd" title="${F.formatarPct(v / total)} das consultas">${F.formatarNumero(v)}</span></li>`;
        }).join('') : '<li class="vazio-item">Nenhuma consulta no período.</li>';
        $('tempoMedio').textContent = `Tempo médio de resposta: ${F.formatarDuracao(d.tempoMedioMs)}`;

        // Planilha e aviso do último export
        if (r.planilhaUrl) $$('[data-planilha]').forEach(a => { a.href = r.planilhaUrl; a.hidden = false; });
        const exp = r.saude.find(s => s.item === 'Último export'), cache = r.saude.find(s => s.item === 'Idade do cache');
        if (exp && !exportFechado()) {
            $('ultimoExportTitulo').textContent = exp.nivel === 'verde' ? 'Export em dia' : 'Export precisa de atenção';
            $('ultimoExportDesc').textContent = exp.detalhe + (cache ? ` · cache de ${cache.detalhe}` : '');
            $('ultimoExport').hidden = false;
        }
    }

    // ---------- Usuários ----------
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
            const acoes = proprio ? '<span class="texto-suave">você</span>' : `<div class="acoes">
                <button data-acao="papel" data-email="${esc(u.email)}">${u.papel === 'super_admin' ? 'Tornar membro' : 'Tornar super admin'}</button>
                <button data-acao="ativo" data-email="${esc(u.email)}">${u.ativo ? 'Desativar' : 'Reativar'}</button>
                <button data-acao="senha" data-email="${esc(u.email)}">Redefinir senha</button>
                <button data-acao="remover" data-email="${esc(u.email)}" class="perigo">Remover</button></div>`;
            return `<tr><td class="ps-6 forte">${esc(u.nome)}</td><td class="texto-suave">${esc(u.email)}</td>
                <td><span class="selo selo-suave">${u.papel === 'super_admin' ? 'Super admin' : 'Membro'}</span></td>
                <td><span class="selo ${u.ativo ? 'selo-verde' : 'selo-cinza'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td class="pe-6">${acoes}</td></tr>`;
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

    // ---------- Início ----------
    $('anoAtual').textContent = new Date().getFullYear();
    (async function iniciar() {
        const s = API.lerSessao();
        if (!s || !s.access_token) return mostrarLogin();
        API.agendarRefresh(s);
        try { const r = await API.chamar('eu'); mostrarApp(r.usuario); } catch (e) { mostrarLogin(); }
    })();
})();
