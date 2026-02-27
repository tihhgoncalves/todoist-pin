// Background Service Worker
// Executa em background e gerencia eventos da extensão

chrome.runtime.onInstalled.addListener(() => {
  console.log('Todoist Pin extensão instalada');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'pong' });
  }
});
