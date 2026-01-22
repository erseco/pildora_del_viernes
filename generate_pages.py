#!/usr/bin/env python3
import os
import re
import shutil
import html
import yaml
import sys
from datetime import datetime

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
        # Copy only static assets; index will be generated
        for item in ['assets', 'images', 'data.yml', '.nojekyll', 'CNAME']:
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

page_template = """<!DOCTYPE html>
<html lang=\"es\">
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <base href=\"/\">
    {og_tags}
    <meta name=\"twitter:card\" content=\"summary_large_image\">
    <title>{title}</title>
    <link rel=\"icon\" href=\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💊</text></svg>\">
    <link href=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css\" rel=\"stylesheet\">
    <link rel=\"stylesheet\" href=\"assets/css/main.css\">
</head>
<body class=\"bg-light\">
    <a href=\"https://github.com/erseco/pildora_del_viernes\" class=\"github-ribbon\">
        <img width=\"149\" height=\"149\" src=\"https://github.blog/wp-content/uploads/2008/12/forkme_right_darkblue_121621.png\" alt=\"Fork me on GitHub\" loading=\"lazy\">
    </a>
    <div class=\"container py-4\">
        <h1 class=\"text-center mb-4\">{header}</h1>
        {controls}
        <div class=\"row\" id=\"pildorasContainer\">{content}</div>
        <footer class=\"text-center mt-4 pb-4 text-muted\">
            <p>Designed with ❤️ from a remote island</p>
            <p>2025 © Ernesto Serrano · <a href=\"https://github.com/erseco/pildora_del_viernes\" class=\"text-muted\"><i class=\"bi bi-github\"></i> Código fuente</a></p>
        </footer>
    </div>
    <link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css\">
    <script src=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js\"></script>
    <script src=\"assets/js/static.js\"></script>
</body>
</html>
"""

def simple_markdown_to_html(text: str) -> str:
    """Very small markdown-to-HTML: escape, linkify, bold/italic, code blocks, linebreaks."""
    if not text:
        return ''

    # Extract code blocks first (```lang\ncode\n```) to protect them
    code_blocks = []
    def save_code_block(match):
        lang = match.group(1) or ''
        code = match.group(2)
        code_blocks.append((lang, code))
        return f'\x00CODEBLOCK{len(code_blocks)-1}\x00'
    text = re.sub(r'```(\w*)\n(.*?)```', save_code_block, text, flags=re.DOTALL)

    # Extract inline code (`code`) to protect it
    inline_codes = []
    def save_inline_code(match):
        inline_codes.append(match.group(1))
        return f'\x00INLINECODE{len(inline_codes)-1}\x00'
    text = re.sub(r'`([^`]+)`', save_inline_code, text)

    # Extract markdown links [text](url) before escaping
    md_links = []
    def save_md_link(match):
        md_links.append((match.group(1), match.group(2)))
        return f'\x00MDLINK{len(md_links)-1}\x00'
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', save_md_link, text)

    # Escape HTML
    text = html.escape(text)

    # Convert URLs to links (but not placeholders)
    url_pattern = re.compile(r'(https?://[\w\-._~:/?#\[\]@!$&\'()*+,;=%]+)')
    text = url_pattern.sub(r'<a href="\1" target="_blank">\1</a>', text)

    # Bold **text**
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # Italic *text* (but not **)
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
    # Italic _text_
    text = re.sub(r'_(.+?)_', r'<em>\1</em>', text)

    # Restore markdown links
    for i, (link_text, url) in enumerate(md_links):
        text = text.replace(f'\x00MDLINK{i}\x00', f'<a href="{html.escape(url)}" target="_blank">{html.escape(link_text)}</a>')

    # Restore inline code
    for i, code in enumerate(inline_codes):
        text = text.replace(f'\x00INLINECODE{i}\x00', f'<code>{html.escape(code)}</code>')

    # Restore code blocks
    for i, (lang, code) in enumerate(code_blocks):
        escaped_code = html.escape(code.strip())
        lang_class = f' class="language-{html.escape(lang)}"' if lang else ''
        text = text.replace(f'\x00CODEBLOCK{i}\x00', f'<pre><code{lang_class}>{escaped_code}</code></pre>')

    # Line breaks to <br> (but not inside <pre>)
    parts = re.split(r'(<pre>.*?</pre>)', text, flags=re.DOTALL)
    for j, part in enumerate(parts):
        if not part.startswith('<pre>'):
            parts[j] = part.replace('\n', '<br>')
    text = ''.join(parts)

    # Clean up <br> around <pre> blocks
    text = re.sub(r'<br>\s*<pre>', '<pre>', text)
    text = re.sub(r'</pre>\s*<br>', '</pre>', text)

    return text

def format_date_es(date_str: str) -> str:
    try:
        d = datetime.strptime(date_str, '%Y-%m-%d')
        meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
        return f"{d.day} de {meses[d.month-1]} de {d.year}"
    except Exception:
        return date_str

def render_card(p, single=False):
    date = p.get('date', '')
    description_md = p.get('description', '')
    description_html = simple_markdown_to_html(description_md)
    image = p.get('image')
    url = p.get('url')
    if image:
        img_html = f"<img src=\"images/{html.escape(image)}\" class=\"card-img-top\" alt=\"Píldora del {html.escape(date)}\">"
        img_tag = img_html if single else f"<a href=\"{date}/\">{img_html}</a>"
    else:
        img_tag = ''
    classes = 'col-12 mb-4' if single else 'col-md-6 col-lg-4 mb-4'
    view_btn = '' if single else f"<a href=\"{date}/\" class=\"btn btn-primary\">Ver píldora</a>"
    visit_btn = f"<a href=\"{html.escape(url)}\" class=\"btn btn-secondary\" target=\"_blank\">Visitar enlace</a>" if url else ''
    # Data attributes for share action
    description_attr = html.escape(description_md).replace('\n', ' ')
    image_attr = html.escape(image) if image else ''
    data_attrs = f"data-date=\"{html.escape(date)}\" data-description=\"{description_attr}\" data-image=\"{image_attr}\""
    share_btn = f"<button class=\"btn btn-outline-secondary share-btn\" {data_attrs}><i class=\"bi bi-share\"></i> Compartir</button>"
    return f"""
    <div class=\"{classes}\">
        <div class=\"card h-100 shadow-sm\">
            {img_tag}
            <div class=\"card-body\">
                <div class=\"text-muted small mb-2\">{format_date_es(date)}</div>
                <div class=\"card-text\">{description_html}</div>
                <div class=\"d-flex gap-2 justify-content-between mt-3\">
                    {view_btn}
                    {visit_btn}
                    {share_btn}
                </div>
            </div>
        </div>
    </div>
    """

def generate():
    pildoras = load_data()
    # Sort by date desc
    pildoras.sort(key=lambda x: x.get('date', ''), reverse=True)
    prepare_output_dir()
    clean_output()

    # Generate homepage content
    cards_html = ''.join([render_card(p) for p in pildoras])
    controls = """
        <div class=\"row justify-content-center mb-4\">
            <div class=\"col-md-6\" id=\"searchContainer\">\n                <div class=\"input-group\">\n                    <input type=\"text\" id=\"searchInput\" class=\"form-control\" placeholder=\"Buscar píldoras...\">\n                    <a href=\"https://github.com/erseco/pildora_del_viernes/issues/new?template=pildora.yml\" class=\"btn btn-outline-primary\" target=\"_blank\">\n                        <i class=\"bi bi-plus-circle\"></i> Sugerir nueva píldora\n                    </a>\n                </div>\n            </div>\n            <div class=\"col-md-6 text-center d-none\" id=\"viewAllContainer\">\n                <a href=\"/\" class=\"btn btn-primary\">Ver todas las píldoras</a>\n            </div>
        </div>
    """
    og_home = """
        <meta property=\"og:title\" content=\"💊 Píldoras del Viernes\">\n        <meta property=\"og:description\" content=\"Píldora formativa semanal\">\n        <meta property=\"og:image\" content=\"\">\n        <meta property=\"og:url\" content=\"\">\n    """
    header_home = '💊 Píldoras del Viernes <small class="text-muted fs-6 d-block d-sm-inline">(<span id="pildoraCount">0 de %d</span> píldoras)</small>' % len(pildoras)
    index_html = page_template.format(
        og_tags=og_home,
        title="Píldoras del Viernes",
        header=header_home,
        controls=controls,
        content=cards_html
    )
    with open(os.path.join(OUTPUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(index_html)

    # Generate per-date pages
    for p in pildoras:
        date = p.get('date')
        image = p.get('image')
        image_url = f"{BASE_URL}images/{image}" if image else ''
        desc_og = html.escape(p.get('description', '').replace('\n', ' '))
        og = f"""
        <meta property=\"og:url\" content=\"{BASE_URL}{date}/\">\n        <meta property=\"og:type\" content=\"website\">\n        <meta property=\"og:title\" content=\"Píldora Formativa del {html.escape(date)}\">\n        <meta property=\"og:description\" content=\"{desc_og}\">\n        <meta property=\"og:image\" content=\"{image_url}\">\n        <meta name=\"description\" content=\"{desc_og}\">\n        <meta name=\"twitter:description\" content=\"{desc_og}\">\n        <meta property=\"twitter:domain\" content=\"pildoras.ernesto.es\">\n        <meta property=\"twitter:url\" content=\"{BASE_URL}{date}/\">\n        <meta name=\"twitter:title\" content=\"Píldora Formativa del {html.escape(date)}\">\n        <meta name=\"twitter:image\" content=\"{image_url}\">\n        """
        header = f'💊 Píldoras del Viernes <small class="text-muted fs-6 d-block d-sm-inline">({html.escape(date)})</small>'
        single_card = render_card(p, single=True)
        body_controls = """
        <div class=\"row justify-content-center mb-4\">\n            <div class=\"col-md-12 text-center\" id=\"viewAllContainer\">\n                <a href=\"/\" class=\"btn btn-primary\">Ver todas las píldoras</a>\n            </div>\n        </div>
        """
        html_page = page_template.format(
            og_tags=og,
            title=f"Píldora Formativa del {date}",
            header=header,
            controls=body_controls,
            content=single_card
        )
        dir_path = os.path.join(OUTPUT_DIR, date)
        os.makedirs(dir_path, exist_ok=True)
        with open(os.path.join(dir_path, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html_page)

if __name__ == '__main__':
    generate()
