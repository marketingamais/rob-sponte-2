// Gráficos em SVG puro, reproduzindo os do Efferd Dashboard 2 (Recharts):
// barras com degradê + traço de 2px no topo, e linhas em degrau com brilho.
(function (raiz) {
    const NS = 'http://www.w3.org/2000/svg';
    let seq = 0;

    function el(tag, attrs, pai) {
        const n = document.createElementNS(NS, tag);
        for (const k in attrs) n.setAttribute(k, attrs[k]);
        if (pai) pai.appendChild(n);
        return n;
    }
    // Atributos SVG (fill, stroke, stop-color) não aceitam var(--x): resolve pelo CSS computado
    function cor(alvo, c) {
        const m = /^var\((--[\w-]+)\)$/.exec(String(c).trim());
        return m ? (getComputedStyle(alvo).getPropertyValue(m[1]).trim() || '#23316E') : c;
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    // Guarda os dados no elemento e redesenha quando o tamanho mudar
    function montar(alvo, desenhar) {
        alvo._desenhar = desenhar;
        desenhar();
        if (!alvo._observador && typeof ResizeObserver !== 'undefined') {
            let ultimo = alvo.clientWidth;
            alvo._observador = new ResizeObserver(() => {
                if (alvo.clientWidth !== ultimo) { ultimo = alvo.clientWidth; alvo._desenhar(); }
            });
            alvo._observador.observe(alvo);
        }
    }

    function base(alvo) {
        alvo.innerHTML = '';
        const W = Math.max(alvo.clientWidth, 1), H = Math.max(alvo.clientHeight, 1);
        const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' }, alvo);
        const dica = document.createElement('div');
        dica.className = 'grafico-dica'; dica.hidden = true; alvo.appendChild(dica);
        return { svg, dica, W, H };
    }

    function rotulosX(g, pontos, y, larguraMin) {
        // Mostra 1 a cada k rótulos para não sobrepor
        const passo = pontos.length > 1 ? Math.abs(pontos[1].x - pontos[0].x) : Infinity;
        const k = Math.max(1, Math.ceil(larguraMin / passo));
        const grupo = el('g', { class: 'eixo-x' }, g);
        pontos.forEach((p, i) => {
            if (i % k !== 0) return;
            const t = el('text', { x: p.x, y, 'text-anchor': 'middle' }, grupo);
            t.textContent = p.rotulo;
        });
    }

    function mostrarDica(alvo, dica, ev, titulo, linhas) {
        dica.innerHTML = `<div class="grafico-dica-titulo">${esc(titulo)}</div>` + linhas.map(l =>
            `<div class="grafico-dica-linha"><span class="grafico-dica-cor" style="background:${l.cor}"></span><span>${esc(l.nome)}</span><strong>${esc(l.valor)}</strong></div>`).join('');
        dica.hidden = false;
        const r = alvo.getBoundingClientRect();
        let x = ev.clientX - r.left + 12, y = ev.clientY - r.top - 12;
        if (x + dica.offsetWidth > r.width) x = ev.clientX - r.left - dica.offsetWidth - 12;
        dica.style.left = Math.max(0, x) + 'px';
        dica.style.top = Math.max(0, y - dica.offsetHeight / 2) + 'px';
    }

    function vazio(alvo, texto) {
        const v = document.createElement('div');
        v.className = 'grafico-vazio'; v.textContent = texto; alvo.appendChild(v);
    }

    // dados: [{ rotulo, valor }]; serie: { nome, cor }
    function barras(alvo, dados, serieBruta, opcoes) {
        const o = Object.assign({ vazio: 'Sem dados no período.', formatar: String }, opcoes);
        montar(alvo, () => {
            const serie = Object.assign({}, serieBruta, { cor: cor(alvo, serieBruta.cor) });
            const { svg, dica, W, H } = base(alvo);
            const topo = 8, baixo = 28, plotH = H - topo - baixo;
            const n = dados.length || 1, faixa = W / n;
            const larg = Math.min(faixa * 0.8, 120);
            const max = raiz.Formatos.escalaMax(Math.max(0, ...dados.map(d => d.valor)));
            const gid = 'grad-barra-' + (++seq);
            const defs = el('defs', {}, svg);
            const lg = el('linearGradient', { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
            el('stop', { offset: '0%', 'stop-color': serie.cor, 'stop-opacity': 0.5 }, lg);
            el('stop', { offset: '100%', 'stop-color': serie.cor, 'stop-opacity': 0 }, lg);

            const g = el('g', {}, svg);
            const pontos = [];
            dados.forEach((d, i) => {
                const cx = i * faixa + faixa / 2;
                const h = max ? (d.valor / max) * plotH : 0;
                const x = cx - larg / 2, y = topo + plotH - h;
                if (h > 0) {
                    el('rect', { x, y, width: larg, height: h, fill: `url(#${gid})` }, g);
                    el('rect', { x, y, width: larg, height: 2, fill: serie.cor }, g);
                }
                pontos.push({ x: cx, rotulo: d.rotulo });
                const alvoHover = el('rect', { class: 'alvo', x: i * faixa, y: topo, width: faixa, height: plotH }, g);
                alvoHover.addEventListener('mousemove', ev => mostrarDica(alvo, dica, ev, d.titulo || d.rotulo, [{ cor: serie.cor, nome: serie.nome, valor: o.formatar(d.valor) }]));
                alvoHover.addEventListener('mouseleave', () => { dica.hidden = true; });
            });
            rotulosX(svg, pontos, topo + plotH + 10 + 12, 44);
            if (!dados.some(d => d.valor > 0)) vazio(alvo, o.vazio);
        });
    }

    // dados: [{ rotulo, valores: { chave: n } }]; series: [{ chave, nome, cor }]
    function degraus(alvo, dados, seriesBrutas, opcoes) {
        const o = Object.assign({ vazio: 'Sem dados no período.', formatar: String }, opcoes);
        montar(alvo, () => {
            const series = seriesBrutas.map(s => Object.assign({}, s, { cor: cor(alvo, s.cor) }));
            const { svg, dica, W, H } = base(alvo);
            const esq = 12, dir = 12, topo = 8, baixo = 28;
            const plotW = W - esq - dir, plotH = H - topo - baixo;
            const n = dados.length;
            const todos = dados.flatMap(d => series.map(s => d.valores[s.chave] || 0));
            const max = raiz.Formatos.escalaMax(Math.max(0, ...todos));
            const xDe = i => n <= 1 ? esq + plotW / 2 : esq + (i * plotW) / (n - 1);
            const yDe = v => topo + plotH - (max ? (v / max) * plotH : 0);

            const grade = el('g', { class: 'grade-y' }, svg);
            for (let k = 0; k <= 4; k++) {
                const y = topo + (plotH * k) / 4;
                el('line', { x1: esq, x2: esq + plotW, y1: y, y2: y }, grade);
            }

            const fid = 'brilho-' + (++seq);
            const defs = el('defs', {}, svg);
            const f = el('filter', { id: fid, x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
            el('feGaussianBlur', { stdDeviation: 10, result: 'blur' }, f);
            el('feComposite', { in: 'SourceGraphic', in2: 'blur', operator: 'over' }, f);

            for (const s of series) {
                let d = '';
                if (n === 1) {
                    const y = yDe(dados[0].valores[s.chave] || 0);
                    d = `M${esq},${y}H${esq + plotW}`;
                } else {
                    dados.forEach((p, i) => {
                        const x = xDe(i), y = yDe(p.valores[s.chave] || 0);
                        if (i === 0) d = `M${x},${y}`;
                        else { const meio = (xDe(i - 1) + x) / 2; d += `H${meio}V${y}H${x}`; }
                    });
                }
                if (d) el('path', { d, fill: 'none', stroke: s.cor, 'stroke-width': 2, filter: `url(#${fid})` }, svg);
            }

            const pontos = dados.map((p, i) => ({ x: xDe(i), rotulo: p.rotulo }));
            rotulosX(svg, pontos, topo + plotH + 8 + 12, 44);

            const passo = n > 1 ? plotW / (n - 1) : plotW;
            dados.forEach((p, i) => {
                const x0 = n > 1 ? xDe(i) - passo / 2 : esq;
                const a = el('rect', { class: 'alvo', x: Math.max(0, x0), y: topo, width: passo, height: plotH }, svg);
                a.addEventListener('mousemove', ev => mostrarDica(alvo, dica, ev, p.titulo || p.rotulo,
                    series.map(s => ({ cor: s.cor, nome: s.nome, valor: o.formatar(p.valores[s.chave] || 0) }))));
                a.addEventListener('mouseleave', () => { dica.hidden = true; });
            });
            if (!todos.some(v => v > 0)) vazio(alvo, o.vazio);
        });
    }

    // Área suave com várias séries (painel v2).
    // dias: [{ rotulo, titulo, valores: { chave: n } }]; series: [{ chave, nome, cor }]
    function areas(alvo, dias, seriesBrutas, opcoes) {
        const o = Object.assign({ vazio: 'Sem dados no período.', formatar: String }, opcoes);
        montar(alvo, () => {
            const series = seriesBrutas.map(s => Object.assign({}, s, { cor: cor(alvo, s.cor) }));
            const { svg, dica, W, H } = base(alvo);
            const esq = 12, dir = 12, topo = 8, baixo = 28;
            const plotW = W - esq - dir, plotH = H - topo - baixo;
            const n = dias.length;
            const val = (d, s) => Number(d.valores[s.chave]) || 0;
            const todos = dias.flatMap(d => series.map(s => val(d, s)));
            const max = raiz.Formatos.escalaMax(Math.max(0, ...todos));
            const xDe = i => n <= 1 ? esq + plotW / 2 : esq + (i * plotW) / (n - 1);
            const yDe = v => topo + plotH - (max ? (v / max) * plotH : 0);
            const baseY = topo + plotH;

            // 5 linhas de grade horizontais
            const grade = el('g', { class: 'grade-y' }, svg);
            for (let k = 0; k <= 4; k++) {
                const y = topo + (plotH * k) / 4;
                el('line', { x1: esq, x2: esq + plotW, y1: y, y2: y }, grade);
            }

            const defs = el('defs', {}, svg);
            const camadas = el('g', {}, svg);
            // A série de maior soma vai atrás, para as menores ficarem visíveis por cima
            const soma = s => dias.reduce((t, d) => t + val(d, s), 0);
            const ordem = series.slice().sort((a, b) => soma(b) - soma(a));
            for (const s of ordem) {
                const pts = n === 1
                    ? [{ x: esq, y: yDe(val(dias[0], s)) }, { x: esq + plotW, y: yDe(val(dias[0], s)) }]
                    : dias.map((d, i) => ({ x: xDe(i), y: yDe(val(d, s)) }));
                if (!pts.length) continue;
                // Curva suave: controles nos terços horizontais, com o y dos extremos
                let linha = `M${pts[0].x},${pts[0].y}`;
                for (let i = 1; i < pts.length; i++) {
                    const a = pts[i - 1], b = pts[i];
                    const cx1 = a.x + (b.x - a.x) / 3, cx2 = b.x - (b.x - a.x) / 3;
                    linha += `C${cx1},${a.y} ${cx2},${b.y} ${b.x},${b.y}`;
                }
                const gid = 'grad-area-' + (++seq);
                const lg = el('linearGradient', { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
                el('stop', { offset: '0%', 'stop-color': s.cor, 'stop-opacity': 0.35 }, lg);
                el('stop', { offset: '100%', 'stop-color': s.cor, 'stop-opacity': 0 }, lg);
                const ult = pts[pts.length - 1];
                el('path', { d: `${linha}L${ult.x},${baseY}L${pts[0].x},${baseY}Z`, fill: `url(#${gid})` }, camadas);
                el('path', { d: linha, fill: 'none', stroke: s.cor, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, camadas);
            }

            // Valor de cada linha de grade, à direita e acima dela (com halo da cor do card)
            const rotY = el('g', { class: 'eixo-y' }, svg);
            for (let k = 0; k < 4; k++) {
                const t = el('text', { x: esq + plotW, y: topo + (plotH * k) / 4 - 4, 'text-anchor': 'end' }, rotY);
                t.textContent = raiz.Formatos.formatarNumero(max - (max * k) / 4);
            }

            rotulosX(svg, dias.map((p, i) => ({ x: xDe(i), rotulo: p.rotulo })), baseY + 8 + 12, 44);

            // Guia vertical + pontos do dia sob o mouse
            const guia = el('g', { class: 'guia', visibility: 'hidden' }, svg);
            const guiaLinha = el('line', { y1: topo, y2: baseY }, guia);
            const marcas = series.map(s => el('circle', { r: 3.5, fill: s.cor }, guia));
            const passo = n > 1 ? plotW / (n - 1) : plotW;
            dias.forEach((p, i) => {
                const x0 = n > 1 ? xDe(i) - passo / 2 : esq;
                const a = el('rect', { class: 'alvo', x: Math.max(0, x0), y: topo, width: passo, height: plotH }, svg);
                a.addEventListener('mousemove', ev => {
                    const x = xDe(i);
                    guiaLinha.setAttribute('x1', x); guiaLinha.setAttribute('x2', x);
                    series.forEach((s, j) => { marcas[j].setAttribute('cx', x); marcas[j].setAttribute('cy', yDe(val(p, s))); });
                    guia.setAttribute('visibility', 'visible');
                    mostrarDica(alvo, dica, ev, p.titulo || p.rotulo, series.map(s => ({ cor: s.cor, nome: s.nome, valor: o.formatar(val(p, s)) })));
                });
                a.addEventListener('mouseleave', () => { dica.hidden = true; guia.setAttribute('visibility', 'hidden'); });
            });
            if (!todos.some(v => v > 0)) vazio(alvo, o.vazio);
        });
    }

    // Barras em par por dia (painel v2): escura = base, clara = quem agiu, na mesma escala.
    // dias: [{ rotulo, titulo, base, agiram }]
    function barrasPar(alvo, dias, opcoesBrutas) {
        const o = Object.assign({ nomeBase: 'Consultaram', nomeAcao: 'Agiram', vazio: 'Sem consultas no período.', formatar: String }, opcoesBrutas);
        montar(alvo, () => {
            const corBase = cor(alvo, o.corBase), corAcao = cor(alvo, o.corAcao);
            const { svg, dica, W, H } = base(alvo);
            const topo = 4, baixo = 22, plotH = H - topo - baixo;
            const n = dias.length || 1, faixa = W / n;
            // Par = 70% da faixa; em cards muito largos cada barra para em 32 px
            const vao = Math.min(3, faixa * 0.7 * 0.08), larg = Math.max(1, Math.min(32, (faixa * 0.7 - vao) / 2)), par = larg * 2 + vao;
            const max = raiz.Formatos.escalaMax(Math.max(0, ...dias.map(d => Number(d.base) || 0)));
            const baseY = topo + plotH;
            el('line', { class: 'linha-base', x1: 0, x2: W, y1: baseY + 0.5, y2: baseY + 0.5 }, svg);
            const g = el('g', {}, svg);
            const barra = (x, v, c) => {
                const h = max ? Math.min(1, (Number(v) || 0) / max) * plotH : 0;
                if (h > 0) el('rect', { x, y: baseY - h, width: larg, height: h, rx: Math.min(3, larg / 2), fill: c }, g);
            };
            const pontos = [];
            dias.forEach((d, i) => {
                const cx = i * faixa + faixa / 2, x0 = cx - par / 2;
                barra(x0, d.base, corBase);
                barra(x0 + larg + vao, d.agiram, corAcao);
                pontos.push({ x: cx, rotulo: d.rotulo });
                const a = el('rect', { class: 'alvo', x: i * faixa, y: topo, width: faixa, height: plotH }, svg);
                a.addEventListener('mousemove', ev => mostrarDica(alvo, dica, ev, d.titulo || d.rotulo, [
                    { cor: corBase, nome: o.nomeBase, valor: o.formatar(Number(d.base) || 0) },
                    { cor: corAcao, nome: o.nomeAcao, valor: o.formatar(Number(d.agiram) || 0) }]));
                a.addEventListener('mouseleave', () => { dica.hidden = true; });
            });
            rotulosX(svg, pontos, baseY + 16, 40);
            if (!dias.some(d => Number(d.base) > 0)) vazio(alvo, o.vazio);
        });
    }

    raiz.Graficos = { barras, degraus, areas, barrasPar };
})(window);
