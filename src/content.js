// Content Script
// Executa no contexto da página do Todoist

console.log('Todoist Pin - Content script carregado');

// Mensagem de teste para o background
chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
  if (response?.status === 'pong') {
    console.log('Background script respondeu');
  }
});
