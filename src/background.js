// Background Service Worker
// Gerencia eventos globais da extensão

console.log('[todoist pin] background.js carregado');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[todoist pin] extensão instalada');
});

// Listener para mensagens dos content scripts se necessário
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[todoist pin] mensagem recebida:', request);
  sendResponse({ status: 'ok' });
});
