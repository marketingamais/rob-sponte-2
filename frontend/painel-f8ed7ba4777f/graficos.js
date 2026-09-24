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

    raiz.Graficos = { barras, degraus };
})(window);
