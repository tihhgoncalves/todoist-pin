// Popup Script
// UI do popup da extensão

console.log('[todoist pin] popup.js carregado');

document.addEventListener('DOMContentLoaded', () => {
  console.log('[todoist pin] popup DOM carregado');
  const statusElement = document.getElementById('status');
  
  if (statusElement) {
    statusElement.textContent = 'Todoist Pin Ativo';
  }

  // Botão para fixar tarefa
  const pinButton = document.getElementById('pinButton');
  if (pinButton) {
    pinButton.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'ping' }, (response) => {
            console.log('[todoist pin] popup respondido:', response);
          });
        }
      });
    });
  }

  // Botão de configurações
  const settingsButton = document.getElementById('settingsButton');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      console.log('[todoist pin] abrir configurações');
    });
  }
});
