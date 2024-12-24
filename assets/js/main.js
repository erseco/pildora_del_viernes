function getBasePath() {
    return window.location.pathname.replace(/\/[^/]*$/, '/');
}

function getCurrentWeekPildora(pildoras) {
    // Verificar si hay una fecha en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    
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

function sharePildora(date) {
    // Encontrar la píldora correspondiente
    const pildora = window.pildorasData.pildoras.find(p => p.date === date);
    if (!pildora) return;

    const baseUrl = window.location.origin + getBasePath();
    const shareUrl = `${baseUrl}?date=${date}`;
    const imageUrl = pildora.image ? `${baseUrl}images/${pildora.image}` : '';
    
    // Preparar el texto a compartir
    const formattedDate = new Date(pildora.date).toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    
    const shareText = `Píldora formativa del ${formattedDate}:\n\n${pildora.description}\n\nVer más en: ${shareUrl}`;
    
    if (navigator.share) {
        // Preparar objeto de compartir
        const shareData = {
            title: `Píldora Formativa del ${formattedDate}`,
            text: shareText,
            url: shareUrl
        };

        // Si hay imagen, añadirla al objeto de compartir
        if (pildora.image) {
            fetch(imageUrl)
                .then(response => response.blob())
                .then(blob => {
                    shareData.files = [
                        new File([blob], pildora.image, { type: 'image/jpeg' })
                    ];
                    return navigator.share(shareData);
                })
                .catch(error => {
                    console.error('Error al compartir con imagen:', error);
                    // Intentar compartir sin imagen
                    navigator.share(shareData);
                });
        } else {
            // Compartir sin imagen
            navigator.share(shareData)
                .catch(error => {
                    console.error('Error al compartir:', error);
                    // Si falla, copiar al portapapeles como fallback
                    navigator.clipboard.writeText(shareText)
                        .then(() => alert('¡Contenido copiado al portapapeles!'))
                        .catch(console.error);
                });
        }
    } else {
        navigator.clipboard.writeText(shareText)
            .then(() => alert('¡Contenido copiado al portapapeles!'))
            .catch(console.error);
    }
}

function updateMetaTags(pildora) {
    if (!pildora) return;

    const baseUrl = window.location.origin + getBasePath();
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
        // Guardar los datos globalmente para acceder desde otras funciones
        window.pildorasData = data;
        
        // Ordenar las píldoras por fecha (más recientes primero)
        data.pildoras.sort((a, b) => new Date(b.date) - new Date(a.date));

        const currentPildora = getCurrentWeekPildora(data.pildoras);
        updateMetaTags(currentPildora);
        
        const container = document.getElementById('pildorasContainer');
        const searchInput = document.getElementById('searchInput');
        
        function renderPildoras(pildoras) {
            container.innerHTML = '';
            // Actualizar contador
            document.getElementById('pildoraCount').textContent = `${pildoras.length} de ${data.pildoras.length}`;
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
                                <a href="${getBasePath()}?date=${pildora.date}" class="btn btn-primary">Ver píldora</a>
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
