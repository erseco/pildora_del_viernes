# AGENTS.md — Guía para crear píldoras

Este documento es la fuente única de verdad para que cualquier agente (humano o automatizado) pueda añadir una nueva **Píldora del Viernes** al proyecto sin romper el formato, el build ni el despliegue.

---

## 1. Contexto del proyecto

- **Qué es:** un sitio estático publicado en `https://pildoras.ernesto.es/` con una píldora formativa semanal (recurso útil, truco, web curiosa…).
- **Cadencia:** se publica **cada viernes**. La fecha de la píldora siempre debe caer en viernes (`YYYY-MM-DD`).
- **Fuente de datos:** `data.yml` (lista `pildoras`). El build (`make build` → `generate_pages.py`) genera `public/index.html` y una página por fecha (`public/YYYY-MM-DD/index.html`) con Open Graph + Twitter Cards.
- **Despliegue:** `.github/workflows/deploy.yml` publica a GitHub Pages en cada push a `main` o al cerrar con éxito el workflow de issues.

---

## 2. Checklist obligatorio antes de publicar

Toda píldora **debe** cumplir:

- [ ] **Fecha viernes** en formato `YYYY-MM-DD`.
- [ ] **Imagen** asociada en `images/` con nombre exactamente `YYYY-MM-DD.<ext>` (`jpg`, `png`, `gif`, `webp`, `svg`). El valor `image:` en `data.yml` es solo el nombre del fichero (sin ruta).
- [ ] **Enlace (`url`)** válido, accesible (HTTP 2xx) y con HTTPS siempre que el recurso lo soporte.
- [ ] **Descripción** que empiece **literalmente** por:
  ```
  En la 💊 formativa de hoy viernes: <ENLACE_DIRECTO_SIN_FORMATO> <texto de la píldora>
  ```
  - El enlace va **en crudo** (sin `[texto](url)`, sin `<url>`, sin comillas, sin paréntesis).
  - Debe ser el mismo que el campo `url:`.
  - Todo en una sola línea visual detrás de los dos puntos.
- [ ] YAML válido (el workflow `validate-yaml.yml` lo comprueba en cada push/PR).
- [ ] No duplicar una píldora existente (buscar por `url` y por descripción antes de añadir).

---

## 3. Estructura exacta de una entrada en `data.yml`

```yaml
  - date: '2026-04-24'
    image: 2026-04-24.webp
    url: https://slop-or-not.space/
    description: |
      En la 💊 formativa de hoy viernes: https://slop-or-not.space/ es un juego online para comprobar si realmente sabemos distinguir textos escritos por personas de textos generados por IA…
```

Reglas:

- Usar bloque literal `description: |` para poder meter saltos de línea y markdown sin escapar.
- **Nunca** uses `description: >` (plegaría líneas y rompería listas/código).
- Indentación: 2 espacios para la lista, 4 para las claves de la entrada, 6 para el cuerpo del `|`.
- Orden sugerido de claves: `date`, `image`, `url`, `description`.
- Entre entradas deja una línea en blanco (imita el estilo existente).

### Markdown permitido dentro de la descripción
El renderer (`simple_markdown_to_html` en `generate_pages.py`) soporta:

- URLs planas → se convierten en enlaces automáticamente.
- `[texto](url)` en cuerpos secundarios (pero **no** en la primera línea “En la 💊…”, que debe ir en crudo).
- `**negrita**`, `*cursiva*`, `_cursiva_`.
- `` `código inline` `` y bloques ```` ```lang … ``` ````.
- Saltos de línea se convierten a `<br>` (excepto dentro de `<pre>`).

---

## 4. Añadir una píldora — tres caminos

### 4.1. Vía issue de GitHub (recomendado para contribuciones externas)
1. Abre un issue con la plantilla `.github/ISSUE_TEMPLATE/pildora.yml` (botón *“Sugerir nueva píldora”* en la home).
2. Rellena **fecha**, **enlace** y **descripción** (arrastra la imagen en el textarea).
3. Un maintainer aplica la etiqueta `píldora aceptada` → el workflow `Agregar Píldora al data.yml` (`.github/workflows/pildora.yml`) descarga la imagen, la renombra a `YYYY-MM-DD.<ext>`, añade la entrada a `data.yml` y hace commit.

### 4.2. Vía script `send_pill.sh` (desde terminal)
```bash
FECHA=2026-05-01 \
TITULO="Título breve" \
ENLACE="https://ejemplo.com" \
DESCRIPCION="En la 💊 formativa de hoy viernes: https://ejemplo.com …" \
./send_pill.sh
```
Crea un issue pre-rellenado en GitHub. Luego etiquétalo con `píldora aceptada`.

### 4.3. Edición manual (PR directa)
1. Copia la imagen a `images/YYYY-MM-DD.<ext>`.
2. Añade la entrada al final de `data.yml` siguiendo el bloque del punto 3.
3. `make build` localmente para comprobar que no rompe nada (`public/YYYY-MM-DD/index.html` debe generarse).
4. Commit con mensaje: `Agregar píldora del YYYY-MM-DD`.
5. Push a `main` → deploy automático.

---

## 5. Imagen: requisitos prácticos

- Formato: `jpg`/`png` por defecto; `gif` si es animación; `webp` ok; `svg` solo para diagramas/logos vectoriales.
- Proporción pensada para **Open Graph** (≈ 1200×630) para que WhatsApp/Twitter muestren preview decente.
- Peso razonable (< 1 MB salvo que sea un GIF intencional).
- Nombre **siempre** `YYYY-MM-DD.<ext>` — el backfill del share button usa este nombre para adjuntar el fichero.
- Si el recurso no tiene una captura obvia, usa el favicon/logo oficial sobre fondo neutro antes que dejarla en `null`.

> El campo `image: null` **está permitido por el schema** pero **no debe usarse** para píldoras nuevas: el checklist del punto 2 exige imagen.

---

## 6. Validación de enlaces

Los enlaces rotos son el principal motivo de rot en el archivo. Antes de publicar y periódicamente:

### 6.1. Validación local (CLI)
Script sugerido para correr sobre `data.yml`:

```bash
python3 - <<'PY'
import yaml, urllib.request, urllib.error, ssl
ctx = ssl.create_default_context()
data = yaml.safe_load(open('data.yml'))
for p in data['pildoras']:
    url = p.get('url')
    if not url: continue
    try:
        req = urllib.request.Request(url, method='HEAD',
              headers={'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:138.0) Gecko/20100101 Firefox/138.0'})
        code = urllib.request.urlopen(req, timeout=8, context=ctx).status
    except urllib.error.HTTPError as e: code = e.code
    except Exception as e: code = f'ERR {e.__class__.__name__}'
    print(f"{p['date']}  {code}  {url}")
PY
```

Marcar para revisión todo lo que devuelva 4xx/5xx/ERR. Algunos servidores no soportan `HEAD`; reintenta con `GET` antes de dar por roto un enlace.

### 6.2. Validación desde el móvil (propuesta)
Se puede exponer un **modo diagnóstico oculto** en `index.html`, aprovechando que ya hay un gesto para mostrar píldoras futuras con `Alt`:

- **Atajo de teclado (desktop):** `Alt + Shift + L` → dispara un barrido `fetch('no-cors')` sobre cada `url` visible y colorea las tarjetas (verde/rojo/gris).
- **Gesto táctil (móvil):** triple-tap sobre el título `💊 Píldoras del Viernes` → muestra un botón *“Avanzado”* con la opción **Validar enlaces**.
- Resultado: badge pequeño en cada tarjeta (`200 OK`, `ERR`, `?`) y un `console.log` con el resumen para copiar.

Implementación recomendada en `assets/js/static.js` (no bloqueante, detrás del gesto — que no se ejecute en cada carga normal). Pseudocódigo:

```js
async function validateAllLinks() {
  const cards = document.querySelectorAll('#pildorasContainer > div');
  for (const card of cards) {
    const a = card.querySelector('a.btn-secondary');
    if (!a) continue;
    try {
      await fetch(a.href, { mode: 'no-cors', method: 'HEAD' });
      card.dataset.linkStatus = 'ok';
    } catch (_) {
      card.dataset.linkStatus = 'fail';
    }
  }
}
// Activar con Alt+Shift+L o triple-tap en el h1
```

> Nota: `no-cors` devuelve `opaque` siempre que el servidor responda — sirve para detectar DNS muertos y 5xx de red, no 404 reales. Para un chequeo fiable complementa con el script CLI del 6.1 o un workflow nocturno de GitHub Actions.

### 6.3. Validación automatizada (pendiente)
Recomendado añadir un workflow `.github/workflows/linkcheck.yml` con `lychee` o `linkinator` corriendo semanalmente sobre `data.yml` y abriendo un issue con los enlaces rotos.

---

## 7. Flujo recomendado para un agente

> **Regla importante sobre fuentes:** si el usuario pide una píldora pasando una URL de **microsiervos.com** (u otro agregador tipo blog/curador), esa URL es la **fuente**, **no el destino**. Hay que abrir el artículo, extraer la URL externa del producto/servicio/juego del que habla el post, y usar **esa** como `url:` de la píldora. La imagen (`og:image`) y parte del texto sí pueden salir del post, y se acredita al final con «Vía [Microsiervos](url-del-post)».
>
> Extracción rápida:
> ```bash
> curl -sL -A "Mozilla/5.0" "<url-microsiervos>" | \
>   grep -oE 'href="https?://[^"]+"' | \
>   grep -viE 'microsiervos|twitter|facebook|googletagmanager|flipboard|telegram|whatsapp|instagram|bluesky|bsky|mastodon|tiktok|linkedin|gravatar' | sort -u
> ```

1. **Resolver fecha:** próximo viernes respecto a `today`. Si el usuario pide una fecha concreta, verificar que es viernes.
2. **Verificar duplicados:** `grep -i "<dominio>" data.yml`.
3. **Descargar imagen** del recurso (captura o logo) y guardarla como `images/YYYY-MM-DD.<ext>`.
4. **Construir la descripción** respetando el template:
   ```
   En la 💊 formativa de hoy viernes: <url> <texto>…
   ```
5. **Validar** el `url` con un `curl -IL -A "Mozilla/5.0" <url>` (2xx esperado, seguir redirects).
6. **Insertar la entrada** al final de `data.yml` (ver punto 3).
7. **Build local:** `make build`; abrir `public/YYYY-MM-DD/index.html` para revisar imagen + OG tags.
8. **Commit & push** siguiendo el mensaje `Agregar píldora del YYYY-MM-DD`.
9. **Smoke test** posterior al deploy: abrir `https://pildoras.ernesto.es/YYYY-MM-DD/` y comprobar preview OG con `https://www.opengraph.xyz/` o pegando el enlace en un chat de prueba de WhatsApp.

---

## 8. Errores típicos a evitar

- ❌ `description:` en una sola línea sin `|` con saltos → rompe YAML o la descripción queda plana.
- ❌ Empezar con “En la píldora formativa…” (falta el emoji 💊) — el template canónico actual usa **`En la 💊 formativa de hoy viernes:`**.
- ❌ Meter el enlace como `[texto](url)` en la primera línea: el requisito es **URL en crudo** para que sea clicable también en plano y para el preview de WhatsApp.
- ❌ Imagen con nombre distinto a la fecha (`foto.png` en lugar de `2026-05-01.png`).
- ❌ Olvidar el `image:` cuando existe la captura (dejar `null`).
- ❌ `https` mal escrito (`htttps://`, `http ://`) — revisar siempre.
- ❌ Publicar en día que no es viernes sin razón.

---

## 9. Comandos rápidos

```bash
make build          # Genera public/
make serve          # Build + sirve en http://localhost:9090
python3 -c "import yaml; yaml.safe_load(open('data.yml'))"   # valida YAML
./send_pill.sh      # Crea issue prellenado en GitHub
```
