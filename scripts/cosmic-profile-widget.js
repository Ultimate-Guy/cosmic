(() => {
  'use strict';
  if (window.__COSMIC_PROFILE_WIDGET_V1__) return;
  window.__COSMIC_PROFILE_WIDGET_V1__ = true;

  const setup = () => {
    const button = document.getElementById('cosmic-account');
    if (!button || button.dataset.profileWidgetReady) return;
    button.dataset.profileWidgetReady = '1';
    button.style.position = 'fixed';
    button.style.left = '12px';
    button.style.top = '12px';
    button.style.right = 'auto';
    button.style.zIndex = '2147483001';
    button.style.cursor = 'grab';
    button.style.userSelect = 'none';
    button.style.touchAction = 'none';
    button.style.display = 'block';

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    button.addEventListener('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      const rect = button.getBoundingClientRect();
      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      button.style.cursor = 'grabbing';
      button.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    button.addEventListener('pointermove', event => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) moved = true;
      if (!moved) return;
      const left = Math.max(0, Math.min(window.innerWidth - button.offsetWidth, startLeft + dx));
      const top = Math.max(0, Math.min(window.innerHeight - button.offsetHeight, startTop + dy));
      button.style.left = `${left}px`;
      button.style.top = `${top}px`;
      event.preventDefault();
    });

    const finish = event => {
      if (!dragging) return;
      dragging = false;
      button.style.cursor = 'grab';
      if (button.releasePointerCapture?.(event.pointerId) && button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId);
      if (moved) button.dataset.profileDragged = '1';
    };

    button.addEventListener('pointerup', finish);
    button.addEventListener('pointercancel', () => {
      dragging = false;
      button.style.cursor = 'grab';
    });

    button.addEventListener('click', event => {
      if (button.dataset.profileDragged === '1') {
        event.preventDefault();
        event.stopImmediatePropagation();
        button.dataset.profileDragged = '0';
      }
    }, true);

    // Keep the profile control persistent. Launches navigate away naturally,
    // so there is no need to hide the button and risk leaving it stuck hidden.
  };

  const observer = new MutationObserver(setup);
  const start = () => {
    setup();
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
