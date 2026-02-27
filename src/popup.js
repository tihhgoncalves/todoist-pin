// Popup Script
// Executa no popup da extensão

document.addEventListener('DOMContentLoaded', () => {
  const statusElement = document.getElementById('status');
  
  if (statusElement) {
    statusElement.textContent = 'Todoist Pin Ativo';
  }

  // Comunicação com content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'ping' }, (response) => {
        console.log('Response:', response);
      });
    }
  });
});
