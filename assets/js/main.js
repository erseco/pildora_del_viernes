function getCurrentWeekPildora(pildoras) {
    const today = new Date();
    // Encontrar el viernes más reciente
    const day = today.getDay();
    const diff = (day <= 5) ? (day + 2) : (day - 5); // Ajusta al viernes más reciente
    const lastFriday = new Date(today);
    lastFriday.setDate(today.getDate() - diff);
    
    const formattedDate = lastFriday.toISOString().split('T')[0];
    return pildoras.find(p => p.date === formattedDate);
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
                            <div class="text-muted small mb-2">${pildora.date}</div>
                            <div class="card-text">${marked.parse(pildora.description)}</div>
                            <a href="${pildora.url}" class="btn btn-primary mt-3" target="_blank">Visitar</a>
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
