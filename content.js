// Roda no YouTube: a cada 0,5 s olha o quadro atual do vídeo e, se for o
// anúncio em L, dá zoom no jogo (canto superior esquerdo) e esconde o resto.
// Modo debug: quadrinho em cima do player com o status e a prévia sem corte.
(() => {
  const { W, H, luma, medir, candidato, criarMaquina } = globalThis.CortaL;
  const PERIODO = 500;

  // Se esta cópia for injetada de novo (instalação/atualização), só a mais nova roda.
  const eu = Math.random().toString(36).slice(2);
  document.documentElement.dataset.cortaL = eu;
  const souAtual = () => document.documentElement.dataset.cortaL === eu && !!chrome.runtime?.id;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // prévia anotada: o quadro inteiro (sem corte) com o L detectado desenhado
  const previa = document.createElement("canvas");
  previa.width = W; previa.height = H;
  const pctx = previa.getContext("2d");

  document.getElementById("corta-l-estilo")?.remove();
  const estilo = document.createElement("style");
  estilo.id = "corta-l-estilo";
  estilo.textContent = `
    video[data-corta-l] {
      transform-origin: 0 0 !important;
      transform: scale(var(--corta-sx), var(--corta-sy)) !important;
      clip-path: inset(0 var(--corta-cd) var(--corta-cb) 0) !important;
    }
    #corta-l-debug {
      position: absolute; top: 10px; left: 10px; z-index: 9999; pointer-events: none;
      background: rgba(10,10,12,.82); color: #eee; border-radius: 8px; padding: 8px;
      font: 12px/1.45 ui-monospace, Consolas, monospace; box-shadow: 0 2px 10px rgba(0,0,0,.5);
    }
    #corta-l-debug b.on { color: #ff6b5e } #corta-l-debug b.vig { color: #6fdc8c } #corta-l-debug b.off { color: #aaa }
    #corta-l-debug canvas { display: block; margin-top: 6px; width: 256px; height: 144px; border-radius: 4px }`;
  document.documentElement.appendChild(estilo);

  let ativo = true, debug = false;
  let maquina = criarMaquina();
  let videoAtual = null, cortandoAntes = false;
  let ultima = { m: null, g: null, motivo: "iniciando", amostras: 0 };

  chrome.storage.local.get(["ativo", "debug"], r => { ativo = r.ativo !== false; debug = !!r.debug; });
  chrome.storage.onChanged.addListener(m => {
    if (m.ativo) { ativo = m.ativo.newValue !== false; if (!ativo) soltar(); }
    if (m.debug) { debug = !!m.debug.newValue; if (!debug) document.getElementById("corta-l-debug")?.remove(); }
  });

  // o painel (popup) pergunta o estado desta aba
  chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
    if (msg?.tipo !== "estado" || !souAtual()) return;
    const v = videoAtual, m = ultima.m;
    responder({
      ativo, debug,
      cortando: !!ultima.g,
      motivo: ultima.motivo,
      amostras: ultima.amostras,
      dims: v && v.videoWidth ? [v.videoWidth, v.videoHeight] : null,
      medicao: m && { fx: m.x / W, fv: m.fv, fy: m.y / H, fh: m.fh, candidato: candidato(m) },
      ...maquina.info(),
      previa: m ? previa.toDataURL("image/jpeg", 0.8) : null
    });
  });

  function avisar(cortando) {
    if (cortando === cortandoAntes) return;
    cortandoAntes = cortando;
    console.log(`[corta-anuncio-L] ${cortando ? "anúncio em L detectado — cortando" : "voltou ao normal"}`);
    try { chrome.runtime.sendMessage({ cortando }); } catch (e) {}
  }

  function aplicar(v, g) {
    v.style.setProperty("--corta-sx", (1 / g.fx).toFixed(4));
    v.style.setProperty("--corta-sy", (1 / g.fy).toFixed(4));
    v.style.setProperty("--corta-cd", ((1 - g.fx) * 100).toFixed(2) + "%");
    v.style.setProperty("--corta-cb", ((1 - g.fy) * 100).toFixed(2) + "%");
    v.setAttribute("data-corta-l", "");
    avisar(true);
  }

  function soltar() {
    document.querySelectorAll("video[data-corta-l]").forEach(v => v.removeAttribute("data-corta-l"));
    maquina = criarMaquina();
    ultima.g = null;
    avisar(false);
  }

  function anotarPrevia(m, g) {
    pctx.drawImage(canvas, 0, 0);
    if (g) {
      // área do anúncio (o que o corte esconde) em vermelho, área mantida com borda
      const kx = g.fx * W, ky = g.fy * H;
      pctx.fillStyle = "rgba(230,40,30,.45)";
      pctx.fillRect(kx, 0, W - kx, H);
      pctx.fillRect(0, ky, kx, H - ky);
      pctx.strokeStyle = "#ff3b30"; pctx.lineWidth = 2;
      pctx.strokeRect(1, 1, kx - 1, ky - 1);
    } else if (m) {
      // bordas mais fortes encontradas (amarelo = parecem um L; cinza = não)
      pctx.strokeStyle = candidato(m) ? "#ffd60a" : "rgba(255,255,255,.55)";
      pctx.setLineDash([4, 3]); pctx.lineWidth = 1;
      pctx.beginPath();
      pctx.moveTo(m.x + .5, 0); pctx.lineTo(m.x + .5, m.y);
      pctx.moveTo(0, m.y + .5); pctx.lineTo(m.x, m.y + .5);
      pctx.stroke(); pctx.setLineDash([]);
    }
  }

  function desenharDebug() {
    if (!debug) return;
    const player = document.getElementById("movie_player");
    if (!player) return;
    let box = document.getElementById("corta-l-debug");
    if (!box || box.parentElement !== player) {
      box?.remove();
      box = document.createElement("div");
      box.id = "corta-l-debug";
      box.innerHTML = `<div class="txt"></div><canvas width="${W}" height="${H}"></canvas>`;
      player.appendChild(box);
    }
    const { m, g } = ultima, info = maquina.info();
    const pct = f => Math.round(f * 100) + "%";
    const status = !ativo ? `<b class="off">● DESLIGADA</b>`
      : g ? `<b class="on">✂ CORTANDO</b>` : `<b class="vig">● vigiando</b> <span style="opacity:.7">(${ultima.motivo})</span>`;
    const linhas = [`${status}`];
    if (ativo && m) {
      linhas.push(`borda vertical   ${(m.x / W).toFixed(3)}  ${pct(m.fv)}`);
      linhas.push(`borda horizontal ${(m.y / H).toFixed(3)}  ${pct(m.fh)}`);
      linhas.push(`parece L? ${candidato(m) ? "sim" : "não"}  seguidas ${info.seguidas}/${info.precisa}  sem L ${info.falhas}/${info.solta}`);
    }
    box.querySelector(".txt").innerHTML = linhas.join("<br>");
    const c = box.querySelector("canvas");
    c.style.display = ativo && m ? "block" : "none";
    if (ativo && m) c.getContext("2d").drawImage(previa, 0, 0);
  }

  function amostra() {
    if (!souAtual()) {
      clearInterval(timer);
      if (!chrome.runtime?.id) {
        document.querySelectorAll("video[data-corta-l]").forEach(v => v.removeAttribute("data-corta-l"));
        document.getElementById("corta-l-debug")?.remove();
      }
      return;
    }
    if (document.hidden) return;
    if (!ativo) { ultima.motivo = "desligada"; desenharDebug(); return; }

    const v = document.querySelector("#movie_player video.html5-main-video") || document.querySelector("video.html5-main-video");
    if (v !== videoAtual) { soltar(); videoAtual = v; }
    if (!v || v.readyState < 2 || !v.videoWidth) { ultima.motivo = "sem vídeo carregado"; desenharDebug(); return; }
    if (document.querySelector("#movie_player.ad-showing")) { soltar(); ultima.motivo = "anúncio do próprio YouTube"; desenharDebug(); return; }

    let dados;
    try {
      ctx.drawImage(v, 0, 0, W, H);
      dados = ctx.getImageData(0, 0, W, H).data;
    } catch (e) { ultima.motivo = "não consegui ler o quadro: " + e.name; desenharDebug(); return; }

    const m = medir(luma(dados, 4));
    const g = maquina(m);
    ultima = { m, g, motivo: candidato(m) ? "L à vista, confirmando" : "sem anúncio em L", amostras: ultima.amostras + 1 };
    anotarPrevia(m, g);
    if (g) aplicar(v, g);
    else if (v.hasAttribute("data-corta-l")) { v.removeAttribute("data-corta-l"); avisar(false); }
    desenharDebug();
  }

  const timer = setInterval(amostra, PERIODO);
})();
