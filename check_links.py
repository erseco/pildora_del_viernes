#!/usr/bin/env python3
"""Valida los enlaces de data.yml e imprime un listado legible en consola.

Uso:
    ./check_links.py           # recorre todas las píldoras
    make test-links            # idem, vía Makefile
"""
import os
import ssl
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

import yaml

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data.yml")
TIMEOUT = 10
WORKERS = 16
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:138.0) "
    "Gecko/20100101 Firefox/138.0"
)

# Colores ANSI (desactivados si no es TTY)
if sys.stdout.isatty():
    C_RESET, C_BOLD = "\033[0m", "\033[1m"
    C_GREEN, C_RED, C_YELLOW, C_GREY = "\033[32m", "\033[31m", "\033[33m", "\033[90m"
    C_CYAN = "\033[36m"
else:
    C_RESET = C_BOLD = C_GREEN = C_RED = C_YELLOW = C_GREY = C_CYAN = ""


def check(url: str):
    """Devuelve (status_code_or_label, final_url). Prueba HEAD y cae a GET."""
    ctx = ssl.create_default_context()
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(
                url, method=method, headers={"User-Agent": UA}
            )
            with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as r:
                return r.status, r.geturl()
        except urllib.error.HTTPError as e:
            # 405 Method Not Allowed → intentar GET
            if method == "HEAD" and e.code in (400, 403, 405, 501):
                continue
            return e.code, url
        except urllib.error.URLError as e:
            return f"ERR:{e.reason}", url
        except Exception as e:  # timeout, SSL, etc.
            return f"ERR:{type(e).__name__}", url
    return "ERR:unknown", url


def colorize(status):
    s = str(status)
    if s.startswith("2"):
        return f"{C_GREEN}{s:>6}{C_RESET}"
    if s.startswith("3"):
        return f"{C_CYAN}{s:>6}{C_RESET}"
    if s.startswith("4"):
        return f"{C_YELLOW}{s:>6}{C_RESET}"
    return f"{C_RED}{s:>6}{C_RESET}"


def is_ok(status):
    return isinstance(status, int) and 200 <= status < 400


def main():
    with open(DATA, encoding="utf-8") as f:
        pildoras = yaml.safe_load(f).get("pildoras", [])

    targets = [(p["date"], p["url"]) for p in pildoras if p.get("url")]
    skipped = len(pildoras) - len(targets)

    print(
        f"{C_BOLD}Validando {len(targets)} enlaces "
        f"(+{skipped} sin enlace){C_RESET}\n"
    )

    results = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(check, url): (date, url) for date, url in targets}
        for i, fut in enumerate(as_completed(futures), 1):
            date, url = futures[fut]
            status, final = fut.result()
            results.append((date, url, status, final))
            sys.stdout.write(
                f"\r{C_GREY}[{i}/{len(targets)}] {date} {url[:60]}…{C_RESET}" + " " * 10
            )
            sys.stdout.flush()
    sys.stdout.write("\r" + " " * 100 + "\r")

    results.sort(key=lambda r: r[0])
    broken = [r for r in results if not is_ok(r[2])]
    ok = [r for r in results if is_ok(r[2])]

    print(f"{C_BOLD}Resultado:{C_RESET} "
          f"{C_GREEN}{len(ok)} OK{C_RESET} · "
          f"{C_RED}{len(broken)} ROTOS{C_RESET} · "
          f"{C_GREY}{skipped} sin enlace{C_RESET}\n")

    if broken:
        print(f"{C_BOLD}{C_RED}Enlaces rotos:{C_RESET}")
        print(f"{C_BOLD}{'FECHA':<12} {'STATUS':>6}  URL{C_RESET}")
        print("─" * 80)
        for date, url, status, _ in broken:
            print(f"{date:<12} {colorize(status)}  {url}")
        print()
    else:
        print(f"{C_GREEN}✓ Todos los enlaces responden correctamente.{C_RESET}\n")

    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
