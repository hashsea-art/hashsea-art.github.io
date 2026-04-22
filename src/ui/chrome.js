// Page-level UI behavior for static chrome like the info hub and back-to-top link.
let ignoreOutsideCloseForCurrentTick = false;

function getElements() {
  return {
    backToTopLink: document.getElementById('backToTopLink'),
    topTarget: document.getElementById('top'),
  };
}

function getInfoHubElements() {
  return {
    hub: document.querySelector('.info-hub'),
    pageBody: document.body,
    panelsWrap: document.querySelector('.info-panels'),
    tabs: Array.from(document.querySelectorAll('.info-tab[data-panel]')),
    panels: Array.from(document.querySelectorAll('.info-panel-content')),
  };
}

export function closeInfoPanels() {
  const { pageBody, panelsWrap, tabs, panels } = getInfoHubElements();
  if (!pageBody || !tabs.length || !panels.length) return;

  tabs.forEach((tab) => tab.setAttribute('aria-expanded', 'false'));
  panels.forEach((panel) => {
    panel.hidden = true;
    panel.classList.remove('open');
  });
  if (panelsWrap) panelsWrap.hidden = true;
  pageBody.classList.remove('scoring-guide-open');
}

export function openInfoPanel(panelId, { focusTab = false, preserveOnCurrentEvent = false } = {}) {
  const { pageBody, panelsWrap, tabs, panels } = getInfoHubElements();
  if (!pageBody || !tabs.length || !panels.length || !panelId) return false;

  const tab = tabs.find((candidate) => candidate.getAttribute('data-panel') === panelId) || null;
  const panel = panels.find((candidate) => candidate.id === panelId) || null;
  if (!tab || !panel) return false;

  if (preserveOnCurrentEvent) {
    ignoreOutsideCloseForCurrentTick = true;
    window.setTimeout(() => {
      ignoreOutsideCloseForCurrentTick = false;
    }, 0);
  }

  closeInfoPanels();
  if (panelsWrap) panelsWrap.hidden = false;
  tab.setAttribute('aria-expanded', 'true');
  panel.hidden = false;
  panel.classList.add('open');
  if (panelId === 'scoringGuidePanel') {
    pageBody.classList.add('scoring-guide-open');
  }
  if (focusTab) {
    try {
      tab.focus({ preventScroll: true });
    } catch (_) {
      tab.focus();
    }
  }
  return true;
}

export function initInfoHub() {
  const { hub, pageBody, tabs, panels } = getInfoHubElements();
  if (!hub || !pageBody || !tabs.length || !panels.length) return;

  const getOpenPanel = () => panels.find((panel) => !panel.hidden) || null;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const panelId = tab.getAttribute('data-panel');
      if (!panelId) return;

      const isOpen = tab.getAttribute('aria-expanded') === 'true';
      if (isOpen) { closeInfoPanels(); return; }

      openInfoPanel(panelId);
    });
  });

  document.addEventListener('click', (event) => {
    if (ignoreOutsideCloseForCurrentTick) {
      ignoreOutsideCloseForCurrentTick = false;
      return;
    }
    if (!hub.contains(event.target)) closeInfoPanels();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeInfoPanels();
  });

  window.addEventListener(
    'scroll',
    () => {
      const openPanel = getOpenPanel();
      if (!openPanel) return;
      if (openPanel.getBoundingClientRect().bottom <= 0) closeInfoPanels();
    },
    { passive: true }
  );
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
