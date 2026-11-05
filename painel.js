const $ = s => document.querySelector(s);

chrome.storage.local.get(["ativo", "debug"], r => {
  $("#ativo").checked = r.ativo !== false;
  $("#debug").checked = !!r.debug;
});
$("#ativo").onchange = e => chrome.storage.local.set({ ativo: e.target.checked });
$("#debug").onchange = e => chrome.storage.local.set({ debug: e.target.checked });

function mostrar(classe, titulo, detalhes = "", previa = null, legenda = "") {
  $("#titulo").className = classe;
  $("#titulo-txt").textContent = titulo;
  $("#detalhes").innerHTML = detalhes;
  $("#fig").hidden = !previa;
  if (previa) { $("#previa").src = previa; $("#legenda").textContent = legenda; }
}

const pct = f => Math.round(f * 100) + "%";
let tabId = null;

function atualizar() {
  chrome.tabs.sendMessage(tabId, { tipo: "estado" }, r => {
    if (chrome.runtime.lastError || !r) {
      mostrar("", "Não está rodando nesta aba", "Aperte <b>F5</b> na aba do YouTube pra extensão entrar.");
      return;
    }
    if (!r.ativo) { mostrar("", "Desligada", "Ligue no botão acima."); return; }
    const linhas = [];
    if (r.dims) linhas.push(`Vídeo ${r.dims[0]}×${r.dims[1]} · ${r.amostras} quadros analisados`);
    if (r.medicao) {
      const m = r.medicao;
      linhas.push(`Borda vertical ${m.fx.toFixed(3)} (${pct(m.fv)}) · horizontal ${m.fy.toFixed(3)} (${pct(m.fh)})`);
      linhas.push(`Parece L? ${m.candidato ? "sim" : "não"} · seguidas ${r.seguidas}/${r.precisa}`);
    }
    if (r.cortando)
      mostrar("on", "Cortando agora ✂", linhas.join("<br>"), r.previa, "Sem o corte: em vermelho, o anúncio que está escondido");
    else
      mostrar("ok", "Ativa e vigiando — " + r.motivo, linhas.join("<br>"), r.previa,
        "Quadro atual sem corte (linhas amarelas = bordas que parecem um L)");
  });
}

chrome.tabs.query({ active: true, currentWindow: true }, ([aba]) => {
  if (!aba || !/^https:\/\/www\.youtube\.com\//.test(aba.url || "")) {
    mostrar("", "Esta aba não é do YouTube", "Abra um vídeo ou live no YouTube.");
    return;
  }
  tabId = aba.id;
  atualizar();
  setInterval(atualizar, 500);
});
