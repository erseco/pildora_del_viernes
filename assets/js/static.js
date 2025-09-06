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

      const shareText = `${description}\n\nVer más en: ${shareUrl}`;

      if (navigator.share) {
        const shareData = { title: description, text: shareText };
        try {
          if (image) {
            const resp = await fetch(imageUrl);
            const blob = await resp.blob();
            shareData.files = [new File([blob], image, { type: blob.type || 'image/jpeg' })];
          }
          await navigator.share(shareData);
        } catch (err) {
          try {
            await navigator.clipboard.writeText(shareText);
            alert('¡Contenido copiado al portapapeles!');
          } catch (_) {}
        }
      } else {
        try {
          await navigator.clipboard.writeText(shareText);
          alert('¡Contenido copiado al portapapeles!');
        } catch (_) {}
      }
    });
  });
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return; // página por fecha

  const cards = Array.from(document.querySelectorAll('#pildorasContainer > div'));
  const total = cards.length;
  const countSpan = document.getElementById('pildoraCount');
  if (countSpan) countSpan.textContent = `0 de ${total}`;

  let showFuture = false;

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

      if (!showFuture && beyondNextWeek(date)) {
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

  input.addEventListener('input', filter);
  document.addEventListener('keydown', (e) => { if (e.key === 'Alt') { showFuture = true; filter(); } });
  document.addEventListener('keyup', (e) => { if (e.key === 'Alt') { showFuture = false; filter(); } });

  // Primer render
  filter();
}

document.addEventListener('DOMContentLoaded', () => {
  setupShareButtons();
  setupSearch();
});
