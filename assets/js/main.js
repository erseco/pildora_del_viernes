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
                card.className = 'pildora';
                card.innerHTML = `
                    <img src="images/${pildora.image}" alt="Píldora del ${pildora.date}">
                    <div class="date">${pildora.date}</div>
                    <p>${pildora.description}</p>
                    <a href="${pildora.url}" class="button" target="_blank">Visitar</a>
                `;
                container.appendChild(card);
            });
        }

        renderPildoras(data.pildoras);

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredPildoras = data.pildoras.filter(pildora => 
                pildora.description.toLowerCase().includes(searchTerm) ||
                pildora.date.includes(searchTerm)
            );
            renderPildoras(filteredPildoras);
        });

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadPildoras);
