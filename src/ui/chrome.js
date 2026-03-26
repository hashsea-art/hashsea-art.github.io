// Page-level UI behavior for static chrome like the info hub and back-to-top link.
function getElements() {
  return {
    backToTopLink: document.getElementById('backToTopLink'),
    topTarget: document.getElementById('top'),
  };
}

export function initInfoHub() {
  const hub = document.querySelector('.info-hub');
  const tabs = Array.from(document.querySelectorAll('.info-tab'));
  const panels = Array.from(document.querySelectorAll('.info-panel-content'));
  if (!hub || !tabs.length || !panels.length) return;

  const closeAll = () => {
    tabs.forEach((tab) => tab.setAttribute('aria-expanded', 'false'));
    panels.forEach((panel) => {
      panel.hidden = true;
      panel.classList.remove('open');
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const panelId = tab.getAttribute('data-panel');
      const panel = panelId ? document.getElementById(panelId) : null;
      if (!panel) return;

      const isOpen = tab.getAttribute('aria-expanded') === 'true';
      closeAll();

      if (isOpen) return;

      tab.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      panel.classList.add('open');
    });
  });

  document.addEventListener('click', (event) => {
    if (!hub.contains(event.target)) closeAll();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });
}

export function initBackToTopLink() {
  const el = getElements();
  if (!el.backToTopLink) return;

  el.backToTopLink.addEventListener('click', (event) => {
    event.preventDefault();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = prefersReducedMotion ? 'auto' : 'smooth';

    window.scrollTo({ top: 0, behavior });

    const focusTop = () => {
      if (!el.topTarget) return;
      try {
        el.topTarget.focus({ preventScroll: true });
      } catch (_) {
        el.topTarget.focus();
      }
    };

    if (behavior === 'smooth') {
      window.setTimeout(focusTop, 220);
    } else {
      focusTop();
    }
  });
}
