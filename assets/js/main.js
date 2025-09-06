console.log("Freddy, ¿que haces mirando aquí? ¯\\_(ツ)_/¯");

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function getBasePath() {
    const base = document.querySelector('base');
    return base ? base.getAttribute('href') : '/';
}

function getDateFromPath() {
    const match = window.location.pathname.match(/\/(\d{4}-\d{2}-\d{2})\/?$/);
    return match ? match[1] : null;
}

function getCurrentWeekPildora(pildoras) {
    // Verificar si hay una fecha en la URL o en la ruta
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date') || getDateFromPath();
    
    if (dateParam) {
        // Si hay fecha en la URL, mostrar esa píldora independientemente de la fecha
        const pildora = pildoras.find(p => p.date === dateParam);
        if (pildora) {
            // Mostrar el enlace "Ver todas" y ocultar la búsqueda
            document.getElementById('searchContainer').classList.add('d-none');
            document.getElementById('viewAllContainer').classList.remove('d-none');
            document.querySelector('#viewAllContainer a').href = getBasePath();
            // Filtrar el array para que solo contenga esta píldora
            pildoras.length = 0;
            pildoras.push(pildora);
            return pildora;
        }
    } else {
        // Si no hay fecha en la URL, mostrar la búsqueda y ocultar "Ver todas"
        document.getElementById('searchContainer').classList.remove('d-none');
        document.getElementById('viewAllContainer').classList.add('d-none');
    }
    
    // Si no hay fecha en la URL o no es válida, mostrar todas y resaltar la actual
    const today = new Date();
    const day = today.getDay();
    const diff = (day <= 5) ? (day + 2) : (day - 5);
    const lastFriday = new Date(today);
    lastFriday.setDate(today.getDate() - diff);
    
    const formattedDate = lastFriday.toISOString().split('T')[0];
    return pildoras.find(p => p.date === formattedDate);
}

async function sharePildora(date) {
    // Encontrar la píldora correspondiente
    const pildora = window.pildorasData.pildoras.find(p => p.date === date);
    if (!pildora) return;

    const baseUrl = window.location.origin + getBasePath();
    const shareUrl = `${baseUrl}${date}/`;
    const imageUrl = pildora.image ? `${baseUrl}images/${pildora.image}` : '';
    
    // Preparar el texto a compartir
    const formattedDate = new Date(pildora.date).toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    
    // Colocar primero el enlace para forzar preview OG en WhatsApp
    const shareText = `${shareUrl}\n\n${pildora.description}`;

    if (!navigator.share) {
        try {
            await navigator.clipboard.writeText(shareText);
            alert('¡Contenido copiado al portapapeles!');
        } catch (err) {
            console.error('Error al copiar al portapapeles:', err);
        }
        return;
    }

    const shareData = { title: pildora.description, text: shareText };

    try {
        // Compartir solo texto + enlace (sin archivo) para que WhatsApp conserve el texto
        await navigator.share(shareData);
    } catch (error) {
        console.error('Error al compartir:', error);
        try {
            await navigator.clipboard.writeText(shareText);
            alert('¡Contenido copiado al portapapeles!');
        } catch (err3) {
            console.error('Error al copiar al portapapeles:', err3);
        }
    }
}

function updateMetaTags(pildora) {
    if (!pildora) return;

    const baseUrl = window.location.origin + getBasePath();
    const imageUrl = baseUrl + 'images/' + pildora.image;

    const desc = escapeHtml(pildora.description.replace(/\n/g, ' '));
    document.querySelector('meta[property="og:title"]').setAttribute(
        'content',
        desc
    );
    // Opcional: mantener og:description estático si no existe, o actualizar si está presente
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', desc);
    document.querySelector('meta[property="og:image"]').setAttribute('content', imageUrl);
    document.querySelector('meta[property="og:url"]').setAttribute('content', baseUrl + pildora.date + '/');

    // Descriptions para SEO/Twitter
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', desc);
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', desc);
}

async function loadPildoras() {
    try {
        const response = await fetch('/data.yml');
        const yamlText = await response.text();
        const data = jsyaml.load(yamlText);
        // Guardar los datos globalmente para acceder desde otras funciones
        window.pildorasData = data;
        
        // Ordenar las píldoras por fecha (más recientes primero)
        data.pildoras.sort((a, b) => new Date(b.date) - new Date(a.date));

        const currentPildora = getCurrentWeekPildora(data.pildoras);
        updateMetaTags(currentPildora);
        
        const container = document.getElementById('pildorasContainer');
        const searchInput = document.getElementById('searchInput');
        
        function highlightText(text, searchTerm) {
            if (!searchTerm) return text;
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            return text.replace(regex, '<mark>$1</mark>');
        }

        function renderPildoras(pildoras) {
            container.innerHTML = '';
            const searchTerm = searchInput.value.toLowerCase();
            // Actualizar contador
            document.getElementById('pildoraCount').textContent = `${pildoras.length} de ${data.pildoras.length}`;
            pildoras.forEach(pildora => {
                const card = document.createElement('div');
                card.className = (pildoras.length === 1)
                    ? 'col-12 mb-4'
                    : 'col-md-6 col-lg-4 mb-4';
                card.innerHTML = `
                    <div class="card h-100 shadow-sm">
                        ${pildora.image ? `<img src="images/${pildora.image}" class="card-img-top" alt="Píldora del ${pildora.date}">` : ''}
                        <div class="card-body">
                            <div class="text-muted small mb-2">${highlightText(new Date(pildora.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }), searchTerm)}</div>
                            <div class="card-text">${marked.parse(highlightText(escapeHtml(pildora.description), searchTerm))}</div>
                            <div class="d-flex justify-content-between mt-3">
                                <a href="${getBasePath()}${pildora.date}/" class="btn btn-primary">Ver píldora</a>
                                ${pildora.url ? `<a href="${pildora.url}" class="btn btn-secondary" target="_blank">Visitar enlace</a>` : ''}
                                <button class="btn btn-outline-secondary" onclick="sharePildora('${pildora.date}')">
                                    <i class="bi bi-share"></i> Compartir
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        let showFuture = false;

        function filterPildoras() {
            const searchTerm = searchInput.value.toLowerCase();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const filteredPildoras = data.pildoras.filter(pildora => {
                const pildoraDate = new Date(pildora.date);
                pildoraDate.setHours(0, 0, 0, 0);

                const nextWeek = new Date(today);
                nextWeek.setDate(today.getDate() + 6);
                const isBeyondNextWeek = pildoraDate > nextWeek;

                if (!showFuture && isBeyondNextWeek) {
                    return false;
                }

                return pildora.description.toLowerCase().includes(searchTerm) ||
                       String(pildora.date).includes(searchTerm) ||
                       (pildora.url && pildora.url.toLowerCase().includes(searchTerm)) ||
                       marked.parse(escapeHtml(pildora.description)).toLowerCase().includes(searchTerm);
            });

            renderPildoras(filteredPildoras);
        }

        // Eventos para tecla Alt
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Alt') {
                showFuture = true;
                filterPildoras();
            }
        });

        document.addEventListener('keyup', function(event) {
            if (event.key === 'Alt') {
                showFuture = false;
                filterPildoras();
            }
        });

        // Aplicar filtros iniciales
        filterPildoras();

        // Evento para búsqueda
        searchInput.addEventListener('input', filterPildoras);

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadPildoras);
