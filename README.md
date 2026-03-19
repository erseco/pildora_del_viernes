# 💊 Píldora del Viernes

Una iniciativa personal para compartir semanalmente recursos digitales útiles y curiosos.

## 🎯 Objetivo

Cada viernes comparto una "píldora formativa": un recurso digital interesante, una herramienta útil o un sitio web curioso que pueda ser de valor para otros. La idea es mantener estas recomendaciones breves, prácticas y fáciles de digerir, de ahí el nombre "píldora".

## 🛠 Características

- Actualización semanal cada viernes
- Incluye imagen descriptiva
- Descripción concisa del recurso
- Enlace directo al recurso
- Interfaz de búsqueda para encontrar píldoras anteriores
- Acción manual para reubicar una píldora por fecha y desplazar las siguientes si hay conflicto

## 🚀 Uso

1. Clona este repositorio
2. Genera las páginas estáticas (se guardarán en `public/`):
   ```bash
   make build
   ```
3. Ejecuta el servidor local:
   ```bash
   make serve
   ```
4. Abre http://localhost:8000 en tu navegador

Las páginas per-fecha se generan durante el despliegue mediante GitHub Actions, por lo que no se almacenan en el repositorio.

## 🔍 Búsqueda

Puedes buscar píldoras anteriores usando el buscador en la parte superior de la página. La búsqueda funciona tanto por fecha como por descripción.

## 📝 Estructura

- `data.yml`: Contiene todas las píldoras formativas
- `images/`: Capturas de pantalla de los recursos
- `assets/`: Archivos CSS y JavaScript

## 🔁 Reordenar píldoras manualmente

Existe un workflow manual llamado **Reordenar Píldora** en GitHub Actions.

- `pildora`: fecha actual de la píldora que quieres mover (`AAAA-MM-DD`)
- `fecha`: nueva fecha destino (`AAAA-MM-DD`) y debe ser viernes

La acción actualiza `data.yml` y, si la imagen de la píldora usa la fecha como nombre de archivo, también renombra la imagen correspondiente. Si la nueva fecha entra en conflicto con otras píldoras posteriores, las va desplazando al siguiente viernes disponible.
