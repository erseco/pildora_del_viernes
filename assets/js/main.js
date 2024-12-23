function getCurrentWeekPildora(pildoras) {
    // Verificar si hay una fecha en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    
    if (dateParam) {
        const pildora = pildoras.find(p => p.date === dateParam);
        if (pildora) return pildora;
    }

    // Si no hay fecha en la URL o no es válida, usar la fecha actual
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
                        <img src="images/${pildora.image}" class="card-img-top" alt="Píldora del ${pildora.date}">
                        <div class="card-body">
                            <div class="text-muted small mb-2">${new Date(pildora.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            <div class="card-text">${marked.parse(pildora.description)}</div>
                            <div class="d-flex justify-content-between mt-3">
                                <a href="${pildora.url}" class="btn btn-primary" target="_blank">Visitar</a>
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

        renderPildoras(data.pildoras);

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredPildoras = data.pildoras.filter(pildora => 
                pildora.description.toLowerCase().includes(searchTerm) ||
                String(pildora.date).includes(searchTerm) ||
                pildora.url.toLowerCase().includes(searchTerm) ||
                marked.parse(pildora.description).toLowerCase().includes(searchTerm)
            );
            renderPildoras(filteredPildoras);
        });

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadPildoras);
