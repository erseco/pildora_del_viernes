async function loadPildoras() {
    try {
        const response = await fetch('data.yml');
        const yamlText = await response.text();
        const data = jsyaml.load(yamlText);
        
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
                pildora.date.includes(searchTerm) ||
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
