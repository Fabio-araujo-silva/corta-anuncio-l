// Detector do "anúncio em L": a transmissão encolhe o jogo pro canto superior
// esquerdo (~79% do quadro) e enche a faixa da direita e a de baixo com propaganda.
// Procuramos uma borda vertical reta e uma horizontal reta, na mesma proporção.
// Calibrado numa transmissão completa da CazéTV (2h40): 474 de 480 s de anúncio
// cortados, zero falso positivo (layout de estúdio e replay em moldura ficam de fora).
globalThis.CortaL = (() => {
  const W = 256, H = 144;          // resolução de análise
  const LIM = 15;                  // salto mínimo de luminância pra contar como borda
  const FRAC = 0.7;                // fração mínima da linha que precisa ter a borda
  const MIN = 0.74, MAX = 0.84;    // tamanho do jogo encolhido (fração do quadro)
  const PRECISA = 2;               // amostras seguidas com a mesma geometria pra cortar
  const SOLTA = 3;                 // amostras seguidas sem anúncio pra voltar ao normal

  const L = new Float32Array(W * H);

  // rgb: Uint8 com `passo` bytes por pixel (4 no canvas, 3 no teste)
  function luma(rgb, passo) {
    for (let i = 0, j = 0; i < L.length; i++, j += passo)
      L[i] = 0.299 * rgb[j] + 0.587 * rgb[j + 1] + 0.114 * rgb[j + 2];
    return L;
  }

  const XA = Math.floor(MIN * W), XB = Math.ceil(MAX * W);
  const YA = Math.floor(MIN * H), YB = Math.ceil(MAX * H);
  const Y0 = Math.round(0.06 * H), X0 = Math.round(0.06 * W);
  // somas acumuladas: pv[cx][y] = nº de linhas < y com salto na coluna cx (idem ph)
  const pv = Array.from({ length: XB + 1 }, () => new Uint16Array(H + 1));
  const ph = Array.from({ length: YB + 1 }, () => new Uint16Array(W + 1));

  // Mede a "força" de cada borda candidata (fração da linha com salto de luz) e
  // escolhe o PAR vertical+horizontal que forma um L coerente (mesma escala nos
  // dois eixos). A vertical é medida em TODA a altura do jogo encolhido e a
  // horizontal em toda a largura dele — em trechos onde as cores se parecem
  // (céu claro x arte azul-clara do anúncio) o resto da linha compensa.
  function medir(L) {
    for (let cx = XA; cx <= XB; cx++) {
      const p = pv[cx];
      for (let y = 0; y < H; y++)
        p[y + 1] = p[y] + (Math.abs(L[y * W + cx + 1] - L[y * W + cx - 1]) > LIM ? 1 : 0);
    }
    for (let cy = YA; cy <= YB; cy++) {
      const p = ph[cy];
      for (let x = 0; x < W; x++)
        p[x + 1] = p[x] + (Math.abs(L[(cy + 1) * W + x] - L[(cy - 1) * W + x]) > LIM ? 1 : 0);
    }
    let best = { x: 0, y: 0, fv: 0, fh: 0 }, nota = -1;
    for (let cx = XA; cx <= XB; cx++) {
      for (let cy = YA; cy <= YB; cy++) {
        if (Math.abs(cx / W - cy / H) >= 0.03) continue;
        const yf = cy - 2, xf = cx - 2;   // para antes do canto do L
        const fv = (pv[cx][yf] - pv[cx][Y0]) / (yf - Y0);
        const fh = (ph[cy][xf] - ph[cy][X0]) / (xf - X0);
        const n = Math.min(fv, fh);
        if (n > nota) { nota = n; best = { x: cx, y: cy, fv, fh }; }
      }
    }
    return best;
  }

  function candidato(m) {
    const fx = m.x / W, fy = m.y / H;
    return m.fv >= FRAC && m.fh >= FRAC && Math.abs(fx - fy) < 0.03 &&
      fx >= MIN && fx <= MAX && fy >= MIN && fy <= MAX;
  }

  // Máquina de estados com histerese. Recebe a medição de cada amostra
  // (ou null) e devolve {fx, fy} enquanto deve cortar, senão null.
  function criarMaquina() {
    let hits = 0, falhas = 0, ultimo = null, geo = null;
    const passo = m => {
      if (m && candidato(m)) {
        hits = ultimo && Math.abs(m.x - ultimo.x) <= 1 && Math.abs(m.y - ultimo.y) <= 1 ? hits + 1 : 1;
        ultimo = m; falhas = 0;
        if (hits >= PRECISA && (!geo || Math.abs(geo.x - m.x) > 1 || Math.abs(geo.y - m.y) > 1))
          geo = { x: m.x, y: m.y };
      } else {
        hits = 0; ultimo = null; falhas++;
        if (falhas >= SOLTA) geo = null;
      }
      // corta 1 px pra dentro pra não sobrar filete do anúncio
      return geo && { fx: (geo.x - 1) / W, fy: (geo.y - 1) / H };
    };
    passo.info = () => ({ seguidas: hits, falhas, precisa: PRECISA, solta: SOLTA });
    return passo;
  }

  return { W, H, luma, medir, candidato, criarMaquina };
})();
