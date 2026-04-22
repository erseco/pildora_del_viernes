// Búsqueda y compartir sin cargar YAML dinámico

function getBasePath() {
  const base = document.querySelector('base');
  return base ? base.getAttribute('href') : '/';
}

function setupShareButtons() {
  const buttons = document.querySelectorAll('.share-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const date = btn.dataset.date || '';
      const description = btn.dataset.description || '';
      const image = btn.dataset.image || '';

      const baseUrl = window.location.origin + getBasePath();
      const shareUrl = `${baseUrl}${date ? date + '/' : ''}`;
      const imageUrl = image ? `${baseUrl}images/${image}` : '';

      // Texto: primero el enlace para preview OG, luego descripción
      const shareText = `${shareUrl}\n\n${description}`;

      if (!navigator.share) {
        try {
          await navigator.clipboard.writeText(shareText);
          alert('¡Contenido copiado al portapapeles!');
        } catch (_) {}
        return;
      }

      // Intentar compartir con imagen si está disponible
      if (imageUrl && navigator.canShare) {
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const ext = image.split('.').pop().toLowerCase();
          const mimeTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };
          const mimeType = mimeTypes[ext] || 'image/png';
          const file = new File([blob], image, { type: mimeType });

          const shareDataWithFile = { text: shareText, files: [file] };
          if (navigator.canShare(shareDataWithFile)) {
            await navigator.share(shareDataWithFile);
            return;
          }
        } catch (_) {
          // Si falla, continuar con compartir solo texto
        }
      }

      // Fallback: compartir solo texto (sin title para evitar duplicación)
      try {
        await navigator.share({ text: shareText });
      } catch (err) {
        try {
          await navigator.clipboard.writeText(shareText);
          alert('¡Contenido copiado al portapapeles!');
        } catch (_) {}
      }
    });
  });
}

// Estado compartido del modo avanzado (ocultas + validador de enlaces)
const advancedMode = {
  showFuture: false,
  filter: () => {},
};

function setupSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return; // página por fecha

  const cards = Array.from(document.querySelectorAll('#pildorasContainer > div'));
  const total = cards.length;
  const countSpan = document.getElementById('pildoraCount');
  if (countSpan) countSpan.textContent = `0 de ${total}`;

  function parseDate(dateStr) {
    const [y, m, d] = (dateStr || '').split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function beyondNextWeek(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 6);
    return parseDate(dateStr) > nextWeek;
  }

  function filter() {
    const term = input.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach(card => {
      const btn = card.querySelector('.share-btn');
      const date = btn?.dataset.date || '';
      const description = btn?.dataset.description || '';
      const urlEl = card.querySelector('.btn.btn-secondary');
      const url = urlEl ? urlEl.getAttribute('href') : '';

      if (!advancedMode.showFuture && beyondNextWeek(date)) {
        card.classList.add('d-none');
        return;
      }

      const hay = (
        description.toLowerCase().includes(term) ||
        (date && date.includes(term)) ||
        (url && url.toLowerCase().includes(term)) ||
        card.textContent.toLowerCase().includes(term)
      );

      if (hay) {
        card.classList.remove('d-none');
        visible += 1;
      } else {
        card.classList.add('d-none');
      }
    });

    if (countSpan) countSpan.textContent = `${visible} de ${total}`;
  }

  advancedMode.filter = filter;

  input.addEventListener('input', filter);
  // Alt mantiene el peek temporal de píldoras futuras en desktop
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Alt' && !advancedMode.showFuture) {
      advancedMode._tempPeek = true;
      advancedMode.showFuture = true;
      filter();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Alt' && advancedMode._tempPeek) {
      advancedMode._tempPeek = false;
      advancedMode.showFuture = false;
      filter();
    }
  });

  filter();
}

// ---------------------------------------------------------------------------
// Validador de enlaces + modo avanzado
// Doble-clic (o doble-tap) sobre el h1 activa el modo avanzado:
//   - Revela las píldoras ocultas (futuras)
//   - Lanza el validador de enlaces sobre todas las tarjetas visibles
// Alt+Shift+L también lanza solo el validador en desktop.
// fetch no-cors: detecta DNS/red caídos, no distingue 200 de 404.
// ---------------------------------------------------------------------------
async function validateAllLinks() {
  const container = document.getElementById('pildorasContainer');
  if (!container) return;
  const cards = Array.from(container.querySelectorAll(':scope > div'))
    .filter(c => !c.classList.contains('d-none'));

  const toast = showToast(`Validando ${cards.length} enlaces…`);
  let ok = 0, fail = 0, skipped = 0;
  const report = [];

  const timeout = (ms) => new Promise((_, rej) =>
    setTimeout(() => rej(new Error('timeout')), ms));

  await Promise.all(cards.map(async (card) => {
    const link = card.querySelector('a.btn.btn-secondary[target="_blank"]');
    const badge = ensureBadge(card);
    if (!link || !link.href) {
      badge.textContent = '—';
      badge.className = 'link-status link-status--skip';
      skipped += 1;
      return;
    }
    badge.textContent = '…';
    badge.className = 'link-status link-status--pending';
    try {
      await Promise.race([
        fetch(link.href, { method: 'HEAD', mode: 'no-cors', redirect: 'follow' }),
        timeout(8000),
      ]);
      badge.textContent = 'OK';
      badge.className = 'link-status link-status--ok';
      ok += 1;
    } catch (err) {
      badge.textContent = 'ERR';
      badge.className = 'link-status link-status--fail';
      fail += 1;
      report.push({ url: link.href, err: String(err && err.message || err) });
    }
  }));

  const summary = `Validación: ${ok} OK · ${fail} ERR · ${skipped} sin enlace`;
  toast.textContent = summary;
  setTimeout(() => toast.remove(), 6000);
  console.log(`[pildoras] ${summary}`);
  if (report.length) console.table(report);
}

function clearBadges() {
  document.querySelectorAll('.link-status').forEach(el => el.remove());
}

function ensureBadge(card) {
  let badge = card.querySelector('.link-status');
  if (badge) return badge;
  badge = document.createElement('span');
  badge.className = 'link-status';
  const body = card.querySelector('.card-body') || card;
  body.prepend(badge);
  return badge;
}

function showToast(text) {
  let toast = document.getElementById('pildoraToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pildoraToast';
    toast.className = 'pildora-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  return toast;
}

function toggleAdvancedMode() {
  advancedMode.showFuture = !advancedMode.showFuture;
  document.body.classList.toggle('advanced-mode', advancedMode.showFuture);
  advancedMode.filter();
  if (advancedMode.showFuture) {
    validateAllLinks();
  } else {
    clearBadges();
    showToast('Modo avanzado desactivado');
    setTimeout(() => {
      const t = document.getElementById('pildoraToast');
      if (t && t.textContent === 'Modo avanzado desactivado') t.remove();
    }, 2000);
  }
}

function setupAdvancedModeTriggers() {
  // Desktop: Alt + Shift + L → solo validar (sin tocar futuras)
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      validateAllLinks();
    }
  });

  // Desktop + móvil: doble-clic / doble-tap sobre el h1 → modo avanzado
  const heading = document.querySelector('h1');
  if (!heading) return;
  heading.style.cursor = 'pointer';
  heading.title = 'Doble-clic: modo avanzado (ocultas + validar enlaces)';

  // dblclick cubre ratón y suele dispararse también en pantallas táctiles
  heading.addEventListener('dblclick', (e) => {
    e.preventDefault();
    toggleAdvancedMode();
  });

  // Fallback táctil: dos taps consecutivos en < 400ms
  let lastTap = 0;
  heading.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTap < 400) {
      e.preventDefault();
      toggleAdvancedMode();
      lastTap = 0;
    } else {
      lastTap = now;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupShareButtons();
  setupSearch();
  setupAdvancedModeTriggers();
});
