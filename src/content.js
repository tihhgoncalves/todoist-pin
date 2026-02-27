// Content Script - Todoist Pin
// Executa no contexto da página do Todoist

console.log('[todoist pin] content.js carregado na página');

(function () {
  'use strict';

  // ---------- rkLog (formato direto, hora apagada por último) ----------
  function rkLog(event, id) {
    const now = new Date();
    const time =
      now.toLocaleTimeString('pt-BR') +
      '.' +
      String(now.getMilliseconds()).padStart(3, '0');

    const prefixStyle = 'color:#e44332;font-weight:600';
    const eventStyle = 'color:#222;font-weight:600';
    const idStyle = 'color:#0a7';
    const timeStyle = 'color:#bbb';

    console.log(
      `%c[todoist pin]%c ${event}%c ${id ?? ''}%c ${time}`,
      prefixStyle,
      eventStyle,
      idStyle,
      timeStyle
    );
  }

  // ---------- URL / SPA route watcher ----------
  function getTaskSlug(url) {
    try {
      const m = new URL(url).pathname.match(/^\/app\/task\/(.+)$/);
      return m ? m[1] : null;
    } catch (e) {
      return null;
    }
  }

  function createPinIcon(opts = {}) {
    const { size = 24, rotate = 0 } = opts;

    const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg id="Camada_1" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 800 800">
<path d="M565.62,591.67c4.91-.05,9.69-1.53,13.78-4.25,4.08-2.72,7.29-6.57,9.22-11.08,1.3-3.06,1.98-6.34,2-9.67v-284.67c0-6.63-2.63-12.99-7.32-17.68-4.69-4.69-11.05-7.32-17.68-7.32s-12.99,2.63-17.68,7.32c-4.69,4.69-7.32,11.05-7.32,17.68v222.67S253.29,217.33,253.29,217.33c-2.29-2.46-5.05-4.43-8.11-5.79-3.07-1.37-6.38-2.1-9.74-2.16-3.36-.06-6.69.56-9.8,1.82-3.11,1.26-5.94,3.13-8.31,5.5-2.37,2.37-4.25,5.2-5.5,8.31-1.26,3.11-1.88,6.45-1.82,9.8.06,3.36.79,6.67,2.16,9.73,1.37,3.07,3.34,5.83,5.79,8.12l287.33,287.33h-222.67c-6.63,0-12.99,2.63-17.68,7.32-4.69,4.69-7.32,11.05-7.32,17.68s2.63,12.99,7.32,17.68c4.69,4.69,11.05,7.32,17.68,7.32l283,1.67Z"/>
</svg>`;

    // parse SVG string
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    let svg = doc.documentElement;

    // normalize attributes
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', svg.getAttribute('viewBox') || '0 0 24 24');
    svg.removeAttribute('xmlns');

    // forçar fill=currentColor em todos os paths
    svg.querySelectorAll('path').forEach(p => {
      p.style.fill = 'var(--todoist-p4-color)';
    });

    // aplicar rotação
    if (rotate) {
      svg.style.transform = `rotate(${rotate}deg)`;
      svg.style.transformOrigin = '50% 50%';
    }

    svg.style.display = 'block';
    return svg;
  }

  function getTaskId(slug) {
    if (!slug) return null;
    const parts = slug.split('-');
    return parts[parts.length - 1];
  }

  // intercept history methods to detect SPA route changes
  (function interceptHistory() {
    const _push = history.pushState;
    const _replace = history.replaceState;

    window.__tm_native_pushState = _push.bind(history);
    window.__tm_native_replaceState = _replace.bind(history);

    history.pushState = function () {
      const res = _push.apply(this, arguments);
      window.dispatchEvent(new Event('tm-route-change'));
      return res;
    };

    history.replaceState = function () {
      const res = _replace.apply(this, arguments);
      window.dispatchEvent(new Event('tm-route-change'));
      return res;
    };

    window.addEventListener('popstate', () => window.dispatchEvent(new Event('tm-route-change')));
  })();

  let lastSlug = null;
  let lastId = null;
  let pinnedOpenContext = null;
  const PINNED_RESTORE_WINDOW_MS = 60_000;

  function tryRestoreIfPinned(prevId) {
    if (!pinnedOpenContext) return;
    if (pinnedOpenContext.id !== prevId) return;

    const age = Date.now() - pinnedOpenContext.ts;
    if (age > PINNED_RESTORE_WINDOW_MS) {
      rkLog('contexto expirado, não restaurou', prevId);
      pinnedOpenContext = null;
      return;
    }

    const returnUrl = pinnedOpenContext.returnUrl;
    rkLog('tentando restaurar URL salva', prevId);

    try {
      if (window.__tm_native_replaceState) {
        window.__tm_native_replaceState({}, '', returnUrl);
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.dispatchEvent(new Event('tm-route-change'));
        rkLog('restore: replaceState nativo + popstate', prevId);
      } else {
        history.replaceState({}, '', returnUrl);
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.dispatchEvent(new Event('tm-route-change'));
        rkLog('restore: replaceState fallback', prevId);
      }
    } catch (e) {
      rkLog('erro no replaceState', prevId);
    }

    const started = Date.now();
    const checkInterval = 80;
    const maxWait = 700;
    const checkTimer = setInterval(() => {
      const pathNow = location.pathname + location.search + location.hash;
      if (pathNow === returnUrl) {
        const modal = document.querySelector('[data-testid="task-details-modal"]');
        if (!modal) {
          clearInterval(checkTimer);
          rkLog('restore: sucesso (replace levou a UI ao estado esperado)', prevId);
          pinnedOpenContext = null;
          return;
        }
      }

      if ((Date.now() - started) > maxWait) {
        clearInterval(checkTimer);
        try {
          if (window.__tm_native_pushState) {
            window.__tm_native_pushState({}, '', returnUrl);
            window.dispatchEvent(new PopStateEvent('popstate'));
            window.dispatchEvent(new Event('tm-route-change'));
            rkLog('restore: tentou pushState nativo', prevId);
          } else {
            history.pushState({}, '', returnUrl);
            window.dispatchEvent(new PopStateEvent('popstate'));
            window.dispatchEvent(new Event('tm-route-change'));
            rkLog('restore: tentou pushState fallback', prevId);
          }
        } catch (e) {
          rkLog('erro ao tentar pushState', prevId);
        }

        setTimeout(() => {
          const modalAfter = document.querySelector('[data-testid="task-details-modal"]');
          if (modalAfter) {
            rkLog('restore: modal ainda aberto, não precisa reload', prevId);
            pinnedOpenContext = null;
            return;
          }

          if ((location.pathname + location.search + location.hash) === returnUrl) {
            rkLog('restore: UI não reagiu, forçando reload', prevId);
            try {
              location.replace(returnUrl);
            } catch (e) {
              location.href = returnUrl;
            }
            pinnedOpenContext = null;
            return;
          }

          pinnedOpenContext = null;
        }, 350);
      }
    }, checkInterval);
  }

  function checkRoute() {
    const slug = getTaskSlug(location.href);

    if (slug && !lastSlug) {
      lastSlug = slug;
      lastId = getTaskId(slug);
      rkLog('abriu tarefa', lastId);
      return;
    }

    if (slug && lastSlug && slug !== lastSlug) {
      const prevId = lastId;
      rkLog('fechou tarefa', prevId);
      tryRestoreIfPinned(prevId);

      lastSlug = slug;
      lastId = getTaskId(slug);
      rkLog('abriu tarefa', lastId);
      return;
    }

    if (!slug && lastSlug) {
      const prevId = lastId;
      rkLog('fechou tarefa', prevId);
      tryRestoreIfPinned(prevId);

      lastSlug = null;
      lastId = null;
    }
  }

  setTimeout(checkRoute, 300);
  window.addEventListener('tm-route-change', () => setTimeout(checkRoute, 100));

  // ---------- Pin button injection + storage + UI ----------
  const STORAGE_KEY = 'tm_todoist_pinned_tasks_v1';

  function loadPinned() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function savePinned(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function ensureFloatingContainer() {
    let el = document.getElementById('tm-todoist-floating-pins');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'tm-todoist-floating-pins';
    Object.assign(el.style, {
      position: 'fixed',
      right: '12px',
      bottom: '12px',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: '8px',
      alignItems: 'flex-end',
      pointerEvents: 'auto'
    });
    document.body.appendChild(el);
    return el;
  }

  function isModalOpenForTask(taskId) {
    try {
      const modal = document.querySelector('[data-testid="task-details-modal"]');
      if (!modal) return false;
      const candidate = modal.querySelector('[data-item-id]');
      if (candidate && candidate.getAttribute('data-item-id') === taskId) return true;
      if (modal.querySelector(`[data-item-id="${taskId}"]`)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function stripMarkdown(text) {
    if (!text) return '';

    return text
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/(\*\*|__|\*|_|~~)/g, '')
      .replace(/^[#>\-\*\+\d\.\s]+/gm, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function openTaskInSameTab(taskId) {
    try {
      const url = `/app/task/${taskId}`;
      history.pushState({}, '', url);
      window.dispatchEvent(new Event('popstate'));
      window.dispatchEvent(new Event('tm-route-change'));
    } catch (e) {
      rkLog('erro ao abrir internamente', taskId);
    }
  }

  function openTaskFromPinKeepLocation(taskId) {
    pinnedOpenContext = {
      id: taskId,
      returnUrl: location.href,
      ts: Date.now()
    };
    rkLog('abrindo via fixado, salvou URL', taskId);

    const selector = `[data-item-id="${taskId}"]`;
    const el = document.querySelector(selector);
    if (el) {
      simulateClick(el);
    } else {
      openTaskInSameTab(taskId);
    }

    setTimeout(() => {
      if (!isModalOpenForTask(taskId)) openTaskInSameTab(taskId);
    }, 300);
  }

  function simulateClick(node) {
    ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(name => {
      const ev = new MouseEvent(name, { bubbles: true, cancelable: true, view: window });
      node.dispatchEvent(ev);
    });
  }

  function renderPins() {
    const container = ensureFloatingContainer();
    container.innerHTML = '';
    const pins = loadPinned();
    pins.forEach(p => {
      const btn = document.createElement('button');
      btn.textContent = stripMarkdown(p.title || p.id);
      btn.title = stripMarkdown(p.title || p.id);
      Object.assign(btn.style, {
        padding: '6px 8px',
        borderRadius: '10px',
        border: '1px solid rgba(0,0,0,0.12)',
        background: 'white',
        cursor: 'pointer',
        fontSize: '13px',
        maxWidth: '220px',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      });

      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openTaskFromPinKeepLocation(p.id);
      });

      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';

      const close = document.createElement('span');
      close.textContent = '✕';
      Object.assign(close.style, {
        marginLeft: '8px',
        cursor: 'pointer',
        color: 'rgba(0,0,0,0.5)',
        fontSize: '12px'
      });
      close.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const newList = loadPinned().filter(x => x.id !== p.id);
        savePinned(newList);
        renderPins();
        rkLog('desfixou tarefa', p.id);
      });

      wrapper.appendChild(btn);
      wrapper.appendChild(close);
      container.appendChild(wrapper);
    });
  }

  function pinTask(taskObj) {
    const list = loadPinned();
    if (list.find(x => x.id === taskObj.id)) {
      rkLog('já fixada', taskObj.id);
      return;
    }
    list.push(taskObj);
    savePinned(list);
    renderPins();
    rkLog('fixou tarefa', taskObj.id);
  }

  function extractTaskFromModal(modalRoot) {
    const candidate = modalRoot.querySelector('[data-item-id]') || modalRoot.querySelector('[data-item-detail-root]') || modalRoot.querySelector('[data-item-content]');
    if (candidate) {
      const id = candidate.getAttribute('data-item-id') || (candidate.getAttribute('data-item-detail-root') ? candidate.getAttribute('data-item-detail-root') : null);
      const title = candidate.getAttribute('data-item-content') || (candidate.textContent && candidate.textContent.trim().slice(0, 200)) || null;
      return { id, title };
    }
    return null;
  }

  function injectPinButtonIntoModal(modalRoot) {
    try {
      if (modalRoot.querySelector('.tm-pin-action')) return;

      const closeBtn = modalRoot.querySelector('button[aria-label="Fechar tarefa"]');
      if (!closeBtn) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tm-pin-action';
      btn.setAttribute('aria-label', 'Fixar tarefa');
      btn.innerHTML = '';
      btn.appendChild(createPinIcon());

      Object.assign(btn.style, {
        cursor: 'pointer',
      });

      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();

        const t = extractTaskFromModal(modalRoot);
        if (!t || !t.id) {
          rkLog('não encontrou id da tarefa ao fixar');
          return;
        }

        pinTask(t);

        const closeBtnInner = modalRoot.querySelector('button[aria-label="Fechar tarefa"]');
        if (closeBtnInner) {
          setTimeout(() => closeBtnInner.click(), 50);
        }
      });

      closeBtn.insertAdjacentElement('afterend', btn);
    } catch (e) {
      console.error('[todoist pin] erro injectPinButtonIntoModal', e);
    }
  }

  // Mutation observer para injetar botão quando modal abrir
  const modalObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches && node.matches('[data-testid="task-details-modal"]')) {
          injectPinButtonIntoModal(node);
        } else if (node.querySelector) {
          const modal = node.querySelector('[data-testid="task-details-modal"]');
          if (modal) injectPinButtonIntoModal(modal);
        }
      }
    }
  });

  modalObserver.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    const existing = document.querySelector('[data-testid="task-details-modal"]');
    if (existing) injectPinButtonIntoModal(existing);
    renderPins();
  }, 600);

})();
