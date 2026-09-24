(function () {
    const F = window.Formatos, API = window.PainelApi, G = window.Graficos;
    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);
    let usuarioAtual = null, periodo = null, carregamento = 0;
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
        try {
            const s = await API.entrar($('loginEmail').value.trim(), $('loginSenha').value); $('loginSenha').value = ''; catalogo = null; mostrarApp(s.usuario);
            if (s.usuario && s.usuario.papel === 'super_admin') obterCatalogo().catch(() => {});
        }
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

    // Pílula de variação: sentido 'bom' (subir = verde), 'ruim' (subir = vermelho) ou 'neutro'.
    // Devolve 'sobe' | 'desce' | '' (a tendência, para o hover do card).
    function tendencia(v, sentido) {
        if (v === null || v === undefined || v === 0 || sentido === 'neutro') return '';
        return (v > 0) === (sentido === 'bom') ? 'sobe' : 'desce';
    }
    function pintarPilula(alvo, v, tipo, sentido) {
        const t = tendencia(v, sentido);
        alvo.className = 'pilula' + (t ? ' pilula-' + t : '');
        const icone = !v ? 'ti-minus' : v > 0 ? 'ti-arrow-up-right' : 'ti-arrow-down-right';
        alvo.innerHTML = `<i class="ti ${icone}" aria-hidden="true"></i><span>${F.formatarVariacao(v, tipo)}</span>`;
        alvo.title = (v > 0 ? 'Subiu ' : v < 0 ? 'Caiu ' : 'Igual: ') + F.formatarVariacao(v, tipo) + ' em relação ao período anterior';
        alvo.hidden = false;
        return t;
    }
    const card = (chave) => document.querySelector(`#grade [data-kpi="${chave}"]`);
    const campo = (chave, nome) => { const c = card(chave); return c && c.querySelector(`[data-${nome}]`); };

    // KPI de volume: valor, pílula e "vs n no período anterior"
    function kpiVolume(chave, d, ant) {
        const c = card(chave), atual = d[chave], anterior = ant && ant[chave];
        if (!c || !atual) return;
        c.querySelector('[data-valor]').textContent = F.formatarNumero(atual.valor);
        const v = anterior ? F.variacao(atual.valor, anterior.valor) : null;
        const pil = c.querySelector('[data-delta]'), pe = c.querySelector('[data-pe]');
        if (v === null) {
            pil.hidden = true; c.dataset.tendencia = '';
            pe.textContent = anterior ? `${F.formatarNumero(anterior.valor)} no período anterior` : 'sem período anterior para comparar';
            return;
        }
        c.dataset.tendencia = pintarPilula(pil, v, 'pct', c.dataset.sentido);
        pe.textContent = `vs ${F.formatarNumero(anterior.valor)} no período anterior`;
    }

    // Esconde os blocos sem permissão e recalcula as colunas de cada linha da grade
    // (desktop: 12 ÷ visíveis da linha; tablet: em pares, o último ímpar ocupa a linha).
    function organizarGrade(permitidos) {
        const blocos = Array.from($('grade').querySelectorAll(':scope > [data-kpi]'));
        blocos.forEach(el => { el.hidden = !permitidos.includes(el.dataset.kpi); });
        const vis = blocos.filter(el => !el.hidden);
        vis.forEach((el, i) => el.style.setProperty('--i', i));
        const linhas = {};
        vis.forEach(el => (linhas[el.dataset.linha] = linhas[el.dataset.linha] || []).push(el));
        const definir = (el, span, spanT, n) => {
            el.style.setProperty('--span', span); el.style.setProperty('--span-t', spanT); el.style.setProperty('--linhas', n || 1);
        };
        for (const [linha, els] of Object.entries(linhas)) {
            if (linha === '2') {
                const comp = els.find(el => el.dataset.kpi === 'comparativo_diario');
                const lat = els.filter(el => el !== comp);
                if (comp) definir(comp, lat.length ? 8 : 12, 12, lat.length === 2 ? 2 : 1);
                lat.forEach(el => definir(el, comp ? 4 : 12 / lat.length, lat.length === 2 ? 6 : 12));
                continue;
            }
            els.forEach((el, i) => definir(el, 12 / els.length, (els.length % 2 && i === els.length - 1) ? 12 : 6));
        }
        $('dashboardVazio').hidden = vis.length > 0;
    }

    function esqueleto() {
        $('grade').classList.add('carregando');
        $$('#grade [data-valor]').forEach(e => { e.innerHTML = '<span class="esqueleto" style="width:5rem;height:1.6rem"></span>'; });
    }

    const ORIGENS = {
        cache: { icone: 'ti-database', titulo: 'Cache do dia', sub: 'Resposta imediata do banco', sentido: 'neutro' },
        cache_antigo: { icone: 'ti-history', titulo: 'Cache anterior', sub: 'Robô fora do ar; usamos o último dado', sentido: 'ruim' },
        ao_vivo: { icone: 'ti-robot', titulo: 'Robô ao vivo', sub: 'Consulta direta na Sponte', sentido: 'neutro' },
        navegador: { icone: 'ti-world', titulo: 'Erro no navegador', sub: 'CPF inválido ou tempo esgotado', sentido: 'ruim' },
        sem_dados: { icone: 'ti-circle-off', titulo: 'Sem dados', sub: 'CPF não encontrado ou inválido', sentido: 'ruim' }
    };
    const NIVEIS = {
        verde: { icone: 'ti-check', classe: 'seta-sobe', nome: 'OK' },
        amarelo: { icone: 'ti-alert-triangle', classe: 'seta-atencao', nome: 'Atenção' },
        vermelho: { icone: 'ti-alert-octagon', classe: 'seta-desce', nome: 'Crítico' }
    };
    const ICONES_SAUDE = { 'Robô': 'ti-robot', 'Último export': 'ti-file-export', 'Idade do cache': 'ti-database', 'Erros nas últimas 24h': 'ti-alert-circle' };
    // Seta num círculo comparando com o período anterior (sem base: traço neutro)
    function seta(atual, anterior, sentido) {
        if (anterior === null || anterior === undefined) return '<span class="seta" aria-hidden="true"><i class="ti ti-minus"></i></span>';
        const v = atual - anterior, t = tendencia(v, sentido);
        const icone = v > 0 ? 'ti-arrow-up-right' : v < 0 ? 'ti-arrow-down-right' : 'ti-minus';
        const dica = v === 0 ? 'Igual ao período anterior' : `${v > 0 ? 'Subiu' : 'Caiu'} ${F.formatarNumero(Math.abs(v))} vs período anterior`;
        return `<span class="seta${t ? ' seta-' + t : ''}" title="${dica}"><i class="ti ${icone}" aria-hidden="true"></i><span class="sr-only">${dica}</span></span>`;
    }
    function itemMetrica(icone, rotulo, sub, valor, direita) {
        return `<li><i class="ti ${icone} metrica-icone" aria-hidden="true"></i>
            <div class="metrica-texto"><p class="metrica-rotulo">${esc(rotulo)}</p>${sub ? `<p class="metrica-sub">${esc(sub)}</p>` : ''}</div>
            <span class="metrica-valor">${valor}</span>${direita}</li>`;
    }

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
            $$('#grade [data-valor]').forEach(e => { e.textContent = '—'; });
            return;
        }
        desenharDashboard(atual.value, anterior.status === 'fulfilled' ? (anterior.value.dados || null) : null);
    }

    function desenharDashboard(r, ant) {
        const d = r.dados || {}, permitidos = Array.isArray(r.kpis) ? r.kpis : [];
        const p = r.periodo || periodo;
        $('periodoTexto').textContent = p.de === p.ate
            ? `Consultas de boletos em ${F.formatarDia(p.de)}.`
            : `Consultas de boletos de ${F.formatarDia(p.de)} a ${F.formatarDia(p.ate)}.`;
        organizarGrade(permitidos);

        // Linha 1: volume
        ['consultas_total', 'consultas_em_dia', 'consultas_debito', 'encaminhamentos'].forEach(k => kpiVolume(k, d, ant));

        // Linha 2: comparativo diário
        if (d.comparativo_diario) {
            const dias = d.comparativo_diario.dias.map(x => ({ rotulo: F.formatarDia(x.dia), titulo: F.formatarDia(x.dia),
                valores: { total: x.total, emDia: x.emDia, debito: x.debito, encaminhamentos: x.encaminhamentos } }));
            G.areas($('graficoComparativo'), dias, [
                { chave: 'total', nome: 'Consultas', cor: 'var(--primary)' },
                { chave: 'emDia', nome: 'Em dia', cor: '#10B981' },
                { chave: 'debito', nome: 'Com débito', cor: '#F59E0B' },
                { chave: 'encaminhamentos', nome: 'Encaminhados', cor: '#E11D48' }
            ], { vazio: 'Sem consultas no período.', formatar: F.formatarNumero });
        }

        // Destaque: redução de inadimplência
        if (d.reducao_inadimplencia) {
            const x = d.reducao_inadimplencia;
            campo('reducao_inadimplencia', 'valor').textContent = F.formatarPct(x.taxa);
            campo('reducao_inadimplencia', 'barra').style.width = (x.taxa === null || x.taxa === undefined ? 0 : Math.min(100, x.taxa * 100)) + '%';
            campo('reducao_inadimplencia', 'apoio').textContent = x.baseDebito
                ? `Recuperado ${F.formatarMoeda(x.recuperado)} de ${F.formatarMoeda(x.baseDebito)} em débito consultado`
                : 'Sem débito consultado no período.';
        }

        // Tempo humano
        if (d.tempo_humano) {
            const x = d.tempo_humano;
            campo('tempo_humano', 'valor').textContent = F.formatarHoras(x.horasEconomizadas);
            campo('tempo_humano', 'apoio').textContent = `${F.formatarPct(x.reducao)} menos tempo · ${F.formatarNumero(x.semHumano)} consultas sem atendimento`
                + (x.estimado ? ' · tempo do robô estimado (sem consultas ao vivo)' : '');
        }

        // Linha 3: funis
        for (const chave of ['funil_debito', 'funil_amais', 'funil_antecipar']) {
            const x = d[chave]; if (!x) continue;
            const c = card(chave);
            c.querySelector('[data-valor]').textContent = F.formatarNumero(x.agiram);
            const pil = c.querySelector('[data-taxa]'), a = ant && ant[chave];
            // A pílula é sempre neutra e mostra só a taxa; a tendência (em p.p.) vai na linha de apoio
            pil.className = 'pilula pilula-marca';
            pil.textContent = F.formatarPct(x.taxa);
            pil.title = 'Taxa de conversão';
            const v = a && a.base ? F.variacao(x.taxa, a.taxa, 'pontos') : null;
            const apoio = c.querySelector('[data-apoio]');
            apoio.innerHTML = `de ${F.formatarNumero(x.base)} consultas`;
            if (v !== null) {
                const t = tendencia(v, 'bom'), icone = v > 0 ? 'ti-arrow-up-right' : v < 0 ? 'ti-arrow-down-right' : 'ti-minus';
                apoio.innerHTML += ` · <span class="tendencia${t ? ' tendencia-' + t : ''}"><i class="ti ${icone}" aria-hidden="true"></i>${F.formatarVariacao(v, 'pontos')}</span> vs período anterior`;
            }
            G.barrasPar(c.querySelector('[data-grafico]'), (x.dias || []).map(y => ({ rotulo: F.formatarDia(y.dia), titulo: F.formatarDia(y.dia), base: y.base, agiram: y.agiram })),
                { corBase: 'var(--primary)', corAcao: '#9AA6D6', nomeBase: 'Consultaram', nomeAcao: 'Agiram', formatar: F.formatarNumero });
        }

        // Linha 4: financeiro
        for (const chave of ['valor_recuperado', 'valor_antecipado']) {
            const x = d[chave]; if (!x) continue;
            const c = card(chave), a = ant && ant[chave];
            c.querySelector('[data-valor]').textContent = F.formatarMoeda(x.valor);
            const v = a ? F.variacao(x.valor, a.valor) : null, pil = c.querySelector('[data-delta]');
            if (v === null) pil.hidden = true; else pintarPilula(pil, v, 'pct', 'bom');
            c.querySelector('[data-apoio]').textContent = `${F.formatarNumero(x.qtdPagos)} ${x.qtdPagos === 1 ? 'boleto pago' : 'boletos pagos'} depois da cópia`;
            const conf = c.querySelector('[data-conferencia]');
            conf.textContent = x.qtdEmConferencia ? `+ ${F.formatarMoeda(x.emConferencia)} em conferência (${F.formatarNumero(x.qtdEmConferencia)})` : 'Nada em conferência';
            conf.classList.toggle('vazia', !x.qtdEmConferencia);
        }

        // Linha 5: erros por tela
        if (d.erros_por_tela) {
            const antes = {}; ((ant && ant.erros_por_tela) || []).forEach(e => { antes[e.tela] = e.qtd; });
            $('listaErrosTela').innerHTML = d.erros_por_tela.length
                ? d.erros_por_tela.slice(0, 5).map(e => itemMetrica('ti-alert-circle', e.tela, `${F.formatarPct(e.pct)} dos erros`, F.formatarNumero(e.qtd),
                    seta(e.qtd, ant ? (antes[e.tela] || 0) : null, 'ruim'))).join('')
                : '<li class="vazio-item">Nenhum erro no período.</li>';
        }

        // Origem das respostas
        if (d.origem_respostas) {
            const por = d.origem_respostas.porOrigem || {}, porAnt = ant && ant.origem_respostas ? (ant.origem_respostas.porOrigem || {}) : null;
            const origens = Object.entries(por).sort((a, b) => b[1] - a[1]);
            const total = origens.reduce((s, [, v]) => s + v, 0);
            $('listaOrigem').innerHTML = origens.length ? origens.slice(0, 5).map(([k, v]) => {
                const o = ORIGENS[k] || { icone: 'ti-point', titulo: k, sub: '', sentido: 'neutro' };
                return itemMetrica(o.icone, o.titulo, `${F.formatarPct(total ? v / total : 0)} · ${o.sub}`, F.formatarNumero(v), seta(v, porAnt ? (porAnt[k] || 0) : null, o.sentido));
            }).join('') : '<li class="vazio-item">Nenhuma consulta no período.</li>';
            $('tempoMedio').textContent = `Tempo médio de resposta: ${F.formatarDuracao(d.origem_respostas.tempoMedioMs)}`;
        }

        // Saúde do sistema (os problemas primeiro)
        const saude = Array.isArray(r.saude) ? r.saude : [];
        if (permitidos.includes('saude_sistema')) {
            const ruins = saude.filter(s => s.nivel !== 'verde');
            $('saudeResumo').textContent = ruins.length ? `${ruins.length} ${ruins.length === 1 ? 'item precisa' : 'itens precisam'} da sua atenção.` : 'Nada urgente precisa da sua atenção.';
            $('saude').innerHTML = saude.length ? ruins.concat(saude.filter(s => s.nivel === 'verde')).map(s => {
                const n = NIVEIS[s.nivel] || NIVEIS.amarelo;
                return `<li><i class="ti ${ICONES_SAUDE[s.item] || 'ti-activity'} metrica-icone" aria-hidden="true"></i>
                    <div class="metrica-texto"><p class="metrica-rotulo">${esc(s.item)}</p><p class="metrica-sub" title="${esc(s.detalhe)}">${esc(s.detalhe)}</p></div>
                    <span></span><span class="seta ${n.classe}" title="${n.nome}"><i class="ti ${n.icone}" aria-hidden="true"></i><span class="sr-only">${n.nome}</span></span></li>`;
            }).join('') : '<li class="vazio-item">Sem informações de saúde.</li>';
        }

        // Planilha e aviso do último export
        if (r.planilhaUrl) $$('[data-planilha]').forEach(a => { a.href = r.planilhaUrl; a.hidden = false; });
        const exp = saude.find(s => s.item === 'Último export'), cache = saude.find(s => s.item === 'Idade do cache');
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
                ${u.papel === 'super_admin' ? '' : `<button data-acao="kpis" data-email="${esc(u.email)}" title="${Array.isArray(u.kpis) ? 'Lista própria de KPIs' : 'Usa o padrão para novos membros'}">KPIs</button>`}
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
        if (b.dataset.acao === 'kpis') {
            abrirKpis({ tipo: 'membro', usuario: u });
        } else if (b.dataset.acao === 'papel') {
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

    // ---------- KPIs visíveis (por membro e padrão para novos membros) ----------
    const NOMES_GRUPO = { volume: 'Volume', conversao: 'Conversão', financeiro: 'Financeiro', eficiencia: 'Eficiência', operacao: 'Operação' };
    let catalogo = null, kpisModo = null;
    async function obterCatalogo() {
        if (!catalogo) { const r = await API.chamar('eu'); catalogo = r.catalogo || []; }
        return catalogo;
    }
    function montarKpis(lista, marcados) {
        const grupos = {};
        lista.forEach(k => (grupos[k.grupo] = grupos[k.grupo] || []).push(k));
        const ordem = Object.keys(NOMES_GRUPO).filter(g => grupos[g]).concat(Object.keys(grupos).filter(g => !NOMES_GRUPO[g]));
        $('kpisGrupos').innerHTML = ordem.map(g => `<fieldset><legend class="rotulo">${esc(NOMES_GRUPO[g] || g)}</legend><div class="opcoes">${
            grupos[g].map(k => `<label><input type="checkbox" name="kpi" value="${esc(k.chave)}"${marcados.includes(k.chave) ? ' checked' : ''}>${esc(k.rotulo)}</label>`).join('')
        }</div></fieldset>`).join('');
    }
    // modo: { tipo: 'membro', usuario } ou { tipo: 'padrao' }
    async function abrirKpis(modo) {
        try {
            const cat = await obterCatalogo();
            let marcados, desc;
            if (modo.tipo === 'membro' && Array.isArray(modo.usuario.kpis)) {
                marcados = modo.usuario.kpis;
                desc = `O que ${modo.usuario.nome || modo.usuario.email} vê no dashboard.`;
            } else {
                const r = await API.chamar('kpis_padrao_ler');
                if (r.catalogo && r.catalogo.length) catalogo = r.catalogo;
                marcados = r.padrao || [];
                desc = modo.tipo === 'padrao'
                    ? 'O que os membros sem uma lista própria veem no dashboard.'
                    : `${modo.usuario.nome || modo.usuario.email} usa hoje o padrão para novos membros. Ao salvar, passa a ter uma lista própria.`;
            }
            kpisModo = modo;
            $('kpisTitulo').textContent = modo.tipo === 'padrao' ? 'Padrão para novos membros' : `KPIs de ${modo.usuario.nome || modo.usuario.email}`;
            $('kpisDesc').textContent = desc;
            $('kpisErro').hidden = true;
            montarKpis(catalogo || cat, marcados);
            $('dlgKpis').showModal();
        } catch (err) { toast(err.message); }
    }
    $('btnKpisPadrao').addEventListener('click', () => abrirKpis({ tipo: 'padrao' }));
    $('formKpis').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (e.submitter && e.submitter.value === 'cancelar') { $('dlgKpis').close(); return; }
        const lista = Array.from($('kpisGrupos').querySelectorAll('input[name="kpi"]:checked'), i => i.value);
        $('kpisErro').hidden = true; $('btnSalvarKpis').disabled = true;
        try {
            if (kpisModo.tipo === 'padrao') await API.chamar('kpis_padrao_salvar', { padrao: lista });
            else await API.chamar('usuarios_atualizar', { email: kpisModo.usuario.email, kpis: lista });
            $('dlgKpis').close(); toast('KPIs atualizados.');
            if (kpisModo.tipo === 'membro') carregarUsuarios();
        } catch (err) { $('kpisErro').textContent = err.message; $('kpisErro').hidden = false; }
        finally { $('btnSalvarKpis').disabled = false; }
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
        try { const r = await API.chamar('eu'); catalogo = r.catalogo || null; mostrarApp(r.usuario); } catch (e) { mostrarLogin(); }
    })();
})();
