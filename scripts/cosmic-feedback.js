(() => {
  'use strict';
  if (window.__COSMIC_FEEDBACK_V1__) return;
  window.__COSMIC_FEEDBACK_V1__ = true;

  const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfLFwfXdL_Fk8FGAAXPire3yIPX0qIoj3Ua1dAGQsw4pTb98Q/viewform';
  const GAME_FIELD = 'entry.1659521365';

  function openReport(name) {
    const url = new URL(FORM_URL);
    url.searchParams.set('usp', 'pp_url');
    if (name) url.searchParams.set(GAME_FIELD, name);
    window.open(url.href, '_blank', 'noopener');
  }

  function addReportButton(modal) {
    if (!modal || modal.dataset.cosmicFeedbackAdded) return;
    const nameEl = modal.querySelector('.cosmic-stat b');
    if (!nameEl) return;
    const name = nameEl.textContent.trim();
    if (!name) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cosmic-feedback-report';
    button.textContent = 'Report broken';
    button.title = 'Report a problem with this game or app';
    button.addEventListener('click', () => openReport(name));
    const panel = modal.querySelector('.cosmic-panel');
    if (panel) {
      panel.appendChild(button);
      modal.dataset.cosmicFeedbackAdded = '1';
    }
  }

  function scan() {
    addReportButton(document.getElementById('cosmic-detail'));
  }

  const style = document.createElement('style');
  style.textContent = '.cosmic-feedback-report{margin:10px 3px;border:1px solid var(--card-border,#2dccff);border-radius:9px;padding:9px 13px;background:rgba(255,80,80,.10);color:#ff8f8f;cursor:pointer;font-weight:700}.cosmic-feedback-report:hover{background:rgba(255,80,80,.18)}';
  document.head.appendChild(style);

  new MutationObserver(scan).observe(document.body, {childList:true, subtree:true});
  scan();
})();
