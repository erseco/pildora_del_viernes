#!/usr/bin/env python3
import os
import re
import shutil
import html
import yaml
import sys

BASE_URL = "https://pildoras.ernesto.es/"
ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(ROOT, sys.argv[1]) if len(sys.argv) > 1 else ROOT

def load_data():
    with open(os.path.join(ROOT, 'data.yml'), 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    return data.get('pildoras', [])

def prepare_output_dir():
    if OUTPUT_DIR != ROOT:
        if os.path.exists(OUTPUT_DIR):
            shutil.rmtree(OUTPUT_DIR)
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        for item in ['index.html', 'assets', 'images', 'data.yml', '.nojekyll', 'CNAME']:
            src = os.path.join(ROOT, item)
            dst = os.path.join(OUTPUT_DIR, item)
            if os.path.isdir(src):
                shutil.copytree(src, dst)
            elif os.path.isfile(src):
                shutil.copy2(src, dst)

def clean_output():
    pattern = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    for name in os.listdir(OUTPUT_DIR):
        if pattern.match(name) and os.path.isdir(os.path.join(OUTPUT_DIR, name)):
            shutil.rmtree(os.path.join(OUTPUT_DIR, name))

template = """<!DOCTYPE html>
<html lang=\"es\">
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <base href=\"/\">
    <meta property=\"og:title\" content=\"Píldora Formativa del {date}\">
    <meta property=\"og:description\" content=\"{description}\">
    <meta property=\"og:image\" content=\"{image_url}\">
    <meta property=\"og:url\" content=\"{base_url}{date}/\">
    <meta name=\"twitter:card\" content=\"summary_large_image\">
    <title>Píldora Formativa del {date}</title>
    <link rel=\"icon\" href=\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💊</text></svg>\">
    <link href=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css\" rel=\"stylesheet\">
    <link rel=\"stylesheet\" href=\"assets/css/main.css\">
    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js\"></script>
    <script src=\"https://cdn.jsdelivr.net/npm/marked/marked.min.js\"></script>
</head>
<body class=\"bg-light\">
    <a href=\"https://github.com/erseco/pildora_del_viernes\" class=\"github-ribbon\">
        <img width=\"149\" height=\"149\" src=\"https://github.blog/wp-content/uploads/2008/12/forkme_right_darkblue_121621.png\" alt=\"Fork me on GitHub\" loading=\"lazy\">
    </a>
    <div class=\"container py-4\">
        <h1 class=\"text-center mb-4\">💊 Píldoras del Viernes <small class=\"text-muted fs-6\">(<span id=\"pildoraCount\">0</span> píldoras)</small></h1>
        <div class=\"row justify-content-center mb-4\">
            <div class=\"col-md-6 d-none\" id=\"searchContainer\">
                <div class=\"input-group\">
                    <input type=\"text\" id=\"searchInput\" class=\"form-control\" placeholder=\"Buscar píldoras...\">
                    <a href=\"https://github.com/erseco/pildora_del_viernes/issues/new?title=Nueva%20píldora&labels=enhancement&body=**Descripción:**%0A%0A**Fecha%20propuesta:**%0A%0A**URL:**%0A%0A**Imagen:**%20_(adjuntar%20o%20incluir%20enlace)_\" class=\"btn btn-outline-primary\" target=\"_blank\">
                        <i class=\"bi bi-plus-circle\"></i> Sugerir nueva píldora
                    </a>
                </div>
            </div>
            <div class=\"col-md-6 text-center\" id=\"viewAllContainer\">
                <a href=\"/\" class=\"btn btn-primary\">Ver todas las píldoras</a>
            </div>
        </div>
        <div class=\"row\" id=\"pildorasContainer\"></div>
        <footer class=\"text-center mt-4 pb-4 text-muted\">
            <p>Designed with ❤️ from a remote island</p>
            <p>2025 © Ernesto Serrano · <a href=\"https://github.com/erseco/pildora_del_viernes\" class=\"text-muted\"><i class=\"bi bi-github\"></i> Código fuente</a></p>
        </footer>
    </div>
    <link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css\">
    <script src=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js\"></script>
    <script src=\"assets/js/main.js\"></script>
</body>
</html>
"""

def generate():
    pildoras = load_data()
    prepare_output_dir()
    clean_output()
    for p in pildoras:
        date = p.get('date')
        description = html.escape(p.get('description', '').replace('\n', ' '))
        image = p.get('image')
        image_url = f"{BASE_URL}images/{image}" if image else ''
        dir_path = os.path.join(OUTPUT_DIR, date)
        os.makedirs(dir_path, exist_ok=True)
        with open(os.path.join(dir_path, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(template.format(date=date, description=description, image_url=image_url, base_url=BASE_URL))

if __name__ == '__main__':
    generate()
