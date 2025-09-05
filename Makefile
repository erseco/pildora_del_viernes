.PHONY: serve build

build:
	./generate_pages.py public

serve:
	python3 -m http.server -d public 8000
