// Búsqueda y compartir sin cargar YAML dinámico

// Lado mayor (px) al que se normaliza la imagen antes de compartirla.
const SHARE_IMAGE_MAX_SIDE = 1600;

// WhatsApp recorta el pie de foto a 1024 caracteres. Al compartir con imagen se
// acorta la descripción para que el enlace a la píldora sobreviva: es el que
// lleva al texto completo.
const WHATSAPP_CAPTION_LIMIT = 1024;

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

function getBasePath() {
  const base = document.querySelector('base');
  return base ? base.getAttribute('href') : '/';
}

function mimeFromName(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return MIME_BY_EXT[ext] || 'image/png';
}

// Reescala y recomprime a JPEG antes de compartir: las capturas originales llegan
// a varios MB y WhatsApp las recomprime igualmente. También rasteriza los SVG, que
// de otro modo llegarían como documento adjunto en lugar de como foto.
// Los GIF se dejan intactos para no perder la animación.
// Ante cualquier fallo se devuelve el original: normalizar nunca debe romper el compartir.
async function normalizeImageForShare(blob, filename) {
  const original = { blob, filename };
  if (blob.type === 'image/gif') return original;
  const isSvg = blob.type === 'image/svg+xml';

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = objectUrl;
    await img.decode();

    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (!srcW || !srcH) return original;

    // Los SVG son vectoriales: también se pueden ampliar sin perder calidad.
    const ratio = SHARE_IMAGE_MAX_SIDE / Math.max(srcW, srcH);
    const scale = isSvg ? ratio : Math.min(1, ratio);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(srcW * scale));
    canvas.height = Math.max(1, Math.round(srcH * scale));

    const ctx = canvas.getContext('2d');
    // JPEG no tiene canal alfa: sin fondo blanco las transparencias saldrían negras.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const jpeg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!jpeg || !jpeg.size) return original;
    // En SVG compensa aunque pese más: lo que importa es que llegue como foto.
    if (!isSvg && jpeg.size >= blob.size) return original;

    return { blob: jpeg, filename: filename.replace(/\.[^.]*$/, '') + '.jpg' };
  } catch (_) {
    return original;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// WhatsApp tiene su propio formato: *negrita*, _cursiva_ y ```monoespaciado```.
// El markdown de la descripción se traduce antes de compartir para que no viajen
// en crudo los asteriscos dobles ni los corchetes de los enlaces.
function markdownToWhatsApp(md) {
  const CODE = '\u0000';
  const BOLD = '\u0001';
  const spans = [];
  const stash = value => {
    spans.push(value);
    return CODE + (spans.length - 1) + CODE;
  };
  // Quita el esquema y el www./ final para comparar texto y destino de un enlace.
  const bare = s => s.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

  // El código se aparta primero: puede contener asteriscos que no son formato.
  let out = md
    .replace(/```[^\n`]*\n([\s\S]*?)```/g, (_, code) => stash('```\n' + code + '```'))
    .replace(/`([^`\n]+)`/g, (_, code) => stash('```' + code + '```'));

  out = out
    // [texto](url) → «texto: url», o solo la url si el texto ya era la url.
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, text, url) => (bare(text) === bare(url) ? url : text + ': ' + url))
    // **negrita** → marcador: en WhatsApp la negrita lleva un solo asterisco.
    .replace(/\*\*([^*\n]+)\*\*/g, BOLD + '$1' + BOLD)
    // *cursiva* → _cursiva_, porque un asterisco suelto sería negrita.
    .replace(/\*([^*\n]+)\*/g, '_$1_')
    .split(BOLD).join('*');

  return out.replace(new RegExp(CODE + '(\\d+)' + CODE, 'g'), (_, i) => spans[Number(i)]);
}

// Une texto y enlace sin pasarse del pie de foto de WhatsApp. Si no cabe, corta
// por la última palabra entera, así nunca queda una URL partida por la mitad.
function buildCaption(text, url) {
  const suffix = '\n\n' + url;
  const room = WHATSAPP_CAPTION_LIMIT - suffix.length;
  if (text.length <= room) return text + suffix;

  const cut = text
    .slice(0, room - 1)
    .replace(/\S*$/, '')
    .replace(/[\s.,;:]+$/, '');
  return (cut ? cut + '…' : '') + suffix;
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

      // El enlace a la píldora va al final, detrás de la descripción.
      const body = markdownToWhatsApp(description).trim();
      const shareText = `${body}\n\n${shareUrl}`;

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
          const fetched = await response.blob();
          const source = fetched.type ? fetched : new Blob([fetched], { type: mimeFromName(image) });
          const normalized = await normalizeImageForShare(source, image);
          const file = new File([normalized.blob], normalized.filename, { type: normalized.blob.type });

          // Sin `title`: WhatsApp lo ignora y otras apps lo repiten encima del texto.
          const shareDataWithFile = { text: buildCaption(body, shareUrl), files: [file] };
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
