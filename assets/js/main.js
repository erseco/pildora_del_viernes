function getCurrentWeekPildora(pildoras) {
    // Verificar si hay una fecha en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    
    if (dateParam) {
        // Si hay fecha en la URL, mostrar solo esa píldora
        const pildora = pildoras.find(p => p.date === dateParam);
        if (pildora) {
            // Mostrar el enlace "Ver todas" y ocultar la búsqueda
            document.getElementById('searchContainer').classList.add('d-none');
            document.getElementById('viewAllContainer').classList.remove('d-none');
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

function sharePildora(date) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?date=${date}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Píldora Formativa',
            text: 'Mira esta píldora formativa',
            url: shareUrl
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(shareUrl)
            .then(() => alert('¡Enlace copiado al portapapeles!'))
            .catch(console.error);
    }
}

function updateMetaTags(pildora) {
    if (!pildora) return;

    const baseUrl = window.location.origin + window.location.pathname;
    const imageUrl = baseUrl + 'images/' + pildora.image;

    document.querySelector('meta[property="og:title"]').setAttribute('content', 'Píldora Formativa del ' + pildora.date);
    document.querySelector('meta[property="og:description"]').setAttribute('content', pildora.description.split('\n')[0]);
    document.querySelector('meta[property="og:image"]').setAttribute('content', imageUrl);
    document.querySelector('meta[property="og:url"]').setAttribute('content', window.location.href);
}

async function loadPildoras() {
    try {
        const response = await fetch('data.yml');
        const yamlText = await response.text();
        const data = jsyaml.load(yamlText);
        
        // Ordenar las píldoras por fecha (más recientes primero)
        data.pildoras.sort((a, b) => new Date(b.date) - new Date(a.date));

        const currentPildora = getCurrentWeekPildora(data.pildoras);
        updateMetaTags(currentPildora);
        
        const container = document.getElementById('pildorasContainer');
        const searchInput = document.getElementById('searchInput');
        
        function renderPildoras(pildoras) {
            container.innerHTML = '';
            pildoras.forEach(pildora => {
                const card = document.createElement('div');
                card.className = 'col-md-6 col-lg-4 mb-4';
                card.innerHTML = `
                    <div class="card h-100 shadow-sm">
                        ${pildora.image ? `<img src="images/${pildora.image}" class="card-img-top" alt="Píldora del ${pildora.date}">` : ''}
                        <div class="card-body">
                            <div class="text-muted small mb-2">${new Date(pildora.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            <div class="card-text">${marked.parse(pildora.description)}</div>
                            <div class="d-flex justify-content-between mt-3">
                                <a href="?date=${pildora.date}" class="btn btn-primary">Ver píldora</a>
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

        function filterPildoras() {
            const searchTerm = searchInput.value.toLowerCase();
            const showFuture = document.getElementById('showFutureCheck').checked;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const filteredPildoras = data.pildoras.filter(pildora => {
                const pildoraDate = new Date(pildora.date);
                const isInFuture = pildoraDate > today;
                
                if (!showFuture && isInFuture) {
                    return false;
                }

                return pildora.description.toLowerCase().includes(searchTerm) ||
                       String(pildora.date).includes(searchTerm) ||
                       (pildora.url && pildora.url.toLowerCase().includes(searchTerm)) ||
                       marked.parse(pildora.description).toLowerCase().includes(searchTerm);
            });
            
            renderPildoras(filteredPildoras);
        }

        // Aplicar filtros iniciales
        filterPildoras();

        // Eventos para búsqueda y checkbox
        searchInput.addEventListener('input', filterPildoras);
        document.getElementById('showFutureCheck').addEventListener('change', filterPildoras);

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadPildoras);
