// Ícone abre o painel (painel.html). Alt+Shift+L liga/desliga.
// Selo: vermelho ✂ = cortando nesta aba agora; cinza OFF = desligada.
async function lerAtivo() {
  const { ativo = true } = await chrome.storage.local.get("ativo");
  return ativo;
}

function pintar(ativo) {
  chrome.action.setBadgeText({ text: ativo ? "" : "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: "#777" });
  chrome.action.setTitle({ title: `Corta Anúncio em L: ${ativo ? "LIGADA" : "DESLIGADA"}` });
}

chrome.commands.onCommand.addListener(async c => {
  if (c === "alternar") await chrome.storage.local.set({ ativo: !(await lerAtivo()) });
});
chrome.storage.onChanged.addListener(m => { if (m.ativo) pintar(m.ativo.newValue !== false); });

chrome.runtime.onInstalled.addListener(async () => {
  pintar(await lerAtivo());
  // o Chrome só injeta content scripts em abas carregadas DEPOIS da instalação;
  // então entra sozinho nas abas do YouTube que já estavam abertas
  const abas = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
  for (const aba of abas) {
    chrome.scripting.executeScript({ target: { tabId: aba.id }, files: ["detector.js", "content.js"] }).catch(() => {});
  }
});
chrome.runtime.onStartup.addListener(async () => pintar(await lerAtivo()));

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (!sender.tab || !("cortando" in msg)) return;
  const tabId = sender.tab.id;
  if (msg.cortando) {
    chrome.action.setBadgeText({ tabId, text: "✂" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#d33" });
  } else {
    chrome.action.setBadgeText({ tabId, text: (await lerAtivo()) ? "" : "OFF" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#777" });
  }
});
