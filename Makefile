.PHONY: help build serve test-links

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

build: ## Genera las páginas estáticas en public/
	./generate_pages.py public

serve: build ## Genera y sirve el sitio en http://localhost:9090
	@echo "\n  Servidor disponible en: \033[36mhttp://localhost:9090\033[0m\n"
	python3 -m http.server -d public 9090

test-links: ## Comprueba los enlaces de data.yml y lista los rotos
	./check_links.py
