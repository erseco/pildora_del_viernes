#!/usr/bin/env python3
import os
import re
import shutil
import hashlib
import html
import yaml
import sys
from datetime import datetime
from urllib.parse import urlparse

BASE_URL = "https://pildoras.ernesto.es/"
ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(ROOT, sys.argv[1]) if len(sys.argv) > 1 else ROOT

ASSETS = ('assets/css/main.css', 'assets/js/static.js')

def versioned_template(template):
    """Añade ?v=<hash> a CSS y JS para que el navegador no sirva la versión
    cacheada después de un deploy."""
    for rel in ASSETS:
        path = os.path.join(ROOT, rel)
        if not os.path.isfile(path):
            continue
        with open(path, 'rb') as f:
            digest = hashlib.sha1(f.read()).hexdigest()[:8]
        template = template.replace(f'"{rel}"', f'"{rel}?v={digest}"')
    return template

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
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#f7f5f0">
    <base href="/">
    {og_tags}
    <meta name="twitter:card" content="summary_large_image">
    <title>{title}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💊</text></svg>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500&display=swap">
    <link rel="stylesheet" href="assets/css/main.css">
</head>
<body class="{body_class}">
    <header class="site-header">
        <div class="wrap site-header__inner">
            <a href="/" class="brand"><span class="brand__mark" aria-hidden="true">💊</span><span class="brand__name">Píldoras del Viernes</span></a>
            <nav class="site-nav" aria-label="Principal">
                <a href="https://github.com/erseco/pildora_del_viernes" class="site-nav__link">GitHub</a>
                <a href="https://github.com/erseco/pildora_del_viernes/issues/new?template=pildora.yml" class="site-nav__cta" target="_blank" rel="noopener">Sugerir píldora</a>
            </nav>
        </div>
    </header>
    <main class="wrap">
        {content}
    </main>
    <footer class="site-footer">
        <div class="wrap site-footer__inner">
            <span>Designed with ❤️ from a remote island</span>
            <span>2025 © Ernesto Serrano · <a href="https://github.com/erseco/pildora_del_viernes">Código fuente</a></span>
        </div>
    </footer>
    <script src="assets/js/static.js"></script>
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

    # Extract bare URLs and keep them as PLAIN TEXT (intentionally NOT linkified).
    # The raw link must reach the reader verbatim so that, when the description is
    # shared on WhatsApp, the URL travels as plain text and WhatsApp linkifies it
    # natively. Protecting them as placeholders also avoids the bold/italic passes
    # mangling URLs that contain '_' or '*'. For clickable secondary links use the
    # [texto](url) markdown syntax instead.
    bare_urls = []
    def save_bare_url(match):
        bare_urls.append(match.group(0))
        return f'\x00BAREURL{len(bare_urls)-1}\x00'
    text = re.sub(r'https?://[\w\-._~:/?#\[\]@!$&\'()*+,;=%]+', save_bare_url, text)

    # Escape HTML
    text = html.escape(text)

    # Bold **text**
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # Italic *text* (but not **)
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
    # Italic _text_
    text = re.sub(r'_(.+?)_', r'<em>\1</em>', text)

    # Restore markdown links
    for i, (link_text, url) in enumerate(md_links):
        text = text.replace(f'\x00MDLINK{i}\x00', f'<a href="{html.escape(url)}" target="_blank">{html.escape(link_text)}</a>')

    # Restore bare URLs as plain text (escaped, no <a>) — see note above
    for i, bare_url in enumerate(bare_urls):
        text = text.replace(f'\x00BAREURL{i}\x00', html.escape(bare_url))

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

# Solo para MOSTRAR: la frase fija "En la 💊 formativa de hoy viernes: <url>" se oculta
# en pantalla porque se repite en todas las píldoras. data-description (lo que se
# comparte por WhatsApp) sigue llevando la descripción íntegra, con la URL en crudo.
PREFIX_RE = re.compile(r'^\s*En la (?:💊|píldora) formativa de\s+hoy viernes[^:,]*[:,]\s*', re.IGNORECASE)
LEADING_URL_RE = re.compile(r'^https?://\S+\s*')
FIRST_URL_RE = re.compile(r'https?://[^\s)\]]+')

def display_body(p) -> str:
    body = PREFIX_RE.sub('', p.get('description', '') or '', count=1)
    # La URL inicial solo se quita si ya está en el botón "Visitar enlace"
    if p.get('url'):
        body = LEADING_URL_RE.sub('', body, count=1)
    return body.strip()

def host_of(url: str) -> str:
    try:
        host = urlparse(url).hostname or ''
    except Exception:
        host = ''
    return host[4:] if host.startswith('www.') else host

def pill_title(p) -> str:
    """Título derivado de data.yml: la negrita inicial de la descripción
    (p. ej. **Tendedero**), o el dominio del enlace, o la fecha."""
    body = display_body(p)
    m = re.match(r'\*\*([^*\n]{1,60})\*\*', body)
    if m:
        return m.group(1).strip()
    url = p.get('url') or ''
    if not url:
        found = FIRST_URL_RE.search(p.get('description', '') or '')
        url = found.group(0) if found else ''
    return host_of(url) or f"Píldora del {p.get('date', '')}"

def image_html(p, cls, lazy=True):
    image = p.get('image')
    date = p.get('date', '')
    if not image:
        return f'<div class="{cls} {cls}--empty" aria-hidden="true">💊</div>'
    loading = ' loading="lazy" decoding="async"' if lazy else ''
    return (f'<img src="images/{html.escape(image)}" class="{cls}" alt="Píldora del {html.escape(date)}"'
            f' width="1200" height="630"{loading}>')

def share_button(p, cls='btn btn-ghost'):
    date = p.get('date', '')
    description_attr = html.escape(p.get('description', '') or '').replace('\n', '&#10;')
    image_attr = html.escape(p.get('image') or '')
    return (f'<button type="button" class="{cls} share-btn" data-date="{html.escape(date)}" '
            f'data-description="{description_attr}" data-image="{image_attr}">Compartir</button>')

def visit_button(p, cls='btn btn-secondary'):
    url = p.get('url')
    if not url:
        return ''
    return f'<a href="{html.escape(url)}" class="{cls}" target="_blank" rel="noopener">Visitar enlace</a>'

def render_card(p):
    date = p.get('date', '')
    title = html.escape(pill_title(p))
    body_html = simple_markdown_to_html(display_body(p))
    return f"""
    <div class="pill-col" data-date="{html.escape(date)}">
        <article class="pill-card">
            <a href="{date}/" class="pill-card__media" tabindex="-1" aria-hidden="true">{image_html(p, 'pill-card__img')}</a>
            <div class="card-body pill-card__body">
                <time class="pill-card__date" datetime="{html.escape(date)}">{format_date_es(date)}</time>
                <h2 class="pill-card__title"><a href="{date}/">{title}</a></h2>
                <div class="pill-card__text">{body_html}</div>
                <div class="pill-card__actions">
                    <a href="{date}/" class="btn btn-primary">Ver píldora</a>
                    {visit_button(p)}
                    {share_button(p)}
                </div>
            </div>
        </article>
    </div>
    """

def nav_link(p, direction):
    if not p:
        return '<span></span>'
    date = p.get('date', '')
    label = '← Anterior' if direction == 'older' else 'Siguiente →'
    return (f'<a href="{date}/" class="pill-nav__link pill-nav__link--{direction}" data-date="{html.escape(date)}">'
            f'<span class="pill-nav__label">{label} · {format_date_es(date)}</span>'
            f'<span class="pill-nav__title">{html.escape(pill_title(p))}</span></a>')

def render_single(p, older=None, newer=None):
    date = p.get('date', '')
    body_html = simple_markdown_to_html(display_body(p))
    return f"""
    <article class="pill-single card-body">
        <a href="/" class="back-link">← Ver todas las píldoras</a>
        <time class="pill-single__date" datetime="{html.escape(date)}">{format_date_es(date)}</time>
        <h1 class="pill-single__title">{html.escape(pill_title(p))}</h1>
        <figure class="pill-single__figure">{image_html(p, 'pill-single__img', lazy=False)}</figure>
        <div class="pill-single__text">{body_html}</div>
        <div class="pill-single__actions">
            {visit_button(p, 'btn btn-primary btn-lg')}
            {share_button(p, 'btn btn-ghost btn-lg')}
        </div>
        <nav class="pill-nav" aria-label="Otras píldoras">
            {nav_link(older, 'older')}
            {nav_link(newer, 'newer')}
        </nav>
    </article>
    """

def render_home(pildoras):
    years = sorted({(p.get('date') or '')[:4] for p in pildoras if p.get('date')}, reverse=True)
    chips = ''.join(f'<button type="button" class="chip" data-year="{y}" aria-pressed="false">{y}</button>' for y in years)
    cards_html = ''.join(render_card(p) for p in pildoras)
    return f"""
    <section class="hero">
        <h1 class="hero__title">💊 Píldoras del Viernes</h1>
        <p class="hero__meta"><span id="pildoraCount">{len(pildoras)}</span> píldoras · Píldora formativa semanal</p>
        <div class="search" id="searchContainer">
            <input type="search" id="searchInput" class="search__input" placeholder="Buscar píldoras..." aria-label="Buscar píldoras" autocomplete="off">
        </div>
        <div class="chips" id="yearFilter" role="group" aria-label="Filtrar por año">
            <button type="button" class="chip is-active" data-year="" aria-pressed="true">Todas</button>{chips}
        </div>
    </section>
    <div class="pill-grid" id="pildorasContainer">{cards_html}</div>
    <p class="no-results" id="noResults" hidden>Ninguna píldora coincide con la búsqueda.</p>
    <div class="load-more"><button type="button" class="btn btn-ghost btn-lg" id="loadMore" hidden>Ver más</button></div>
    """

def generate():
    pildoras = load_data()
    # Sort by date desc
    pildoras.sort(key=lambda x: x.get('date', ''), reverse=True)
    prepare_output_dir()
    clean_output()

    template = versioned_template(page_template)
    og_home = """
        <meta property="og:title" content="💊 Píldoras del Viernes">
        <meta property="og:description" content="Píldora formativa semanal">
        <meta property="og:image" content="">
        <meta property="og:url" content="">
    """
    index_html = template.format(
        og_tags=og_home,
        title="Píldoras del Viernes",
        body_class="page-home",
        content=render_home(pildoras)
    )
    with open(os.path.join(OUTPUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(index_html)

    # Generate per-date pages
    for i, p in enumerate(pildoras):
        date = p.get('date')
        image = p.get('image')
        image_url = f"{BASE_URL}images/{image}" if image else ''
        desc_og = html.escape(p.get('description', '').replace('\n', ' '))
        title = pill_title(p)
        og = f"""
        <meta property="og:url" content="{BASE_URL}{date}/">
        <meta property="og:type" content="website">
        <meta property="og:title" content="Píldora Formativa del {html.escape(date)}">
        <meta property="og:description" content="{desc_og}">
        <meta property="og:image" content="{image_url}">
        <meta name="description" content="{desc_og}">
        <meta name="twitter:description" content="{desc_og}">
        <meta property="twitter:domain" content="pildoras.ernesto.es">
        <meta property="twitter:url" content="{BASE_URL}{date}/">
        <meta name="twitter:title" content="Píldora Formativa del {html.escape(date)}">
        <meta name="twitter:image" content="{image_url}">
        """
        older = pildoras[i + 1] if i + 1 < len(pildoras) else None
        newer = pildoras[i - 1] if i > 0 else None
        html_page = template.format(
            og_tags=og,
            title=f"{html.escape(title)} · Píldora del {date}",
            body_class="page-single",
            content=render_single(p, older, newer)
        )
        dir_path = os.path.join(OUTPUT_DIR, date)
        os.makedirs(dir_path, exist_ok=True)
        with open(os.path.join(dir_path, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html_page)

if __name__ == '__main__':
    generate()
