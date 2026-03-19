#!/usr/bin/env python3
import argparse
import os
import uuid
from datetime import datetime, timedelta

import yaml


ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATA_FILE = os.path.join(ROOT, "data.yml")
DEFAULT_IMAGES_DIR = os.path.join(ROOT, "images")


def parse_date(value: str):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"Fecha inválida '{value}'. Usa el formato AAAA-MM-DD.") from exc


def next_available_friday(value):
    days_until_friday = (4 - value.weekday()) % 7
    if days_until_friday == 0:
        days_until_friday = 7
    return value + timedelta(days=days_until_friday)


def multiline_str_presenter(dumper, data):
    if "\n" in data:
        return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")
    return dumper.represent_scalar("tag:yaml.org,2002:str", data)


yaml.SafeDumper.add_representer(str, multiline_str_presenter)


def load_pildoras(path):
    with open(path, "r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}

    pildoras = data.get("pildoras")
    if not isinstance(pildoras, list):
        raise ValueError("El archivo data.yml no contiene una lista válida en 'pildoras'.")

    return data, pildoras


def build_entry(entry, new_date):
    old_date = entry.get("date")
    image = entry.get("image")
    new_date_str = new_date.isoformat()
    new_image = image

    if image and image != "null":
        stem, ext = os.path.splitext(image)
        if stem == old_date:
            new_image = f"{new_date_str}{ext}"

    rebuilt = {
        "date": new_date_str,
        "image": new_image,
        "url": entry.get("url"),
        "description": entry.get("description", ""),
    }
    return rebuilt, image, new_image


def reorder_pildoras(pildoras, current_date_str, target_date_str):
    current_date = parse_date(current_date_str)
    target_date = parse_date(target_date_str)

    if target_date.weekday() != 4:
        raise ValueError(f"La nueva fecha debe ser un viernes y '{target_date_str}' no lo es.")

    matches = [index for index, item in enumerate(pildoras) if item.get("date") == current_date_str]
    if not matches:
        raise ValueError(f"No existe ninguna píldora con fecha '{current_date_str}'.")
    if len(matches) > 1:
        raise ValueError(f"Hay varias píldoras con fecha '{current_date_str}'.")

    moving_index = matches[0]
    moving_entry = pildoras[moving_index]

    ordered = []
    for index, item in enumerate(pildoras):
        raw_date = item.get("date")
        if not raw_date:
            raise ValueError(f"La píldora en la posición {index + 1} no tiene fecha.")

        item_date = parse_date(raw_date)
        ordered.append(
            {
                "index": index,
                "date": item_date,
                "entry": item,
                "is_moving": index == moving_index,
            }
        )

    moving_item = next((item for item in ordered if item["is_moving"]), None)
    if moving_item is None:
        raise ValueError(f"No se pudo localizar la píldora '{current_date_str}' para reordenarla.")
    remaining = [item for item in ordered if not item["is_moving"]]
    remaining.sort(key=lambda item: (item["date"], item["index"]))

    updated = []
    image_renames = []

    for item in remaining:
        if item["date"] < target_date:
            rebuilt, old_image, new_image = build_entry(item["entry"], item["date"])
            updated.append((item["date"], item["index"], rebuilt))
            if old_image != new_image:
                image_renames.append((old_image, new_image))

    rebuilt_moving, old_image, new_image = build_entry(moving_item["entry"], target_date)
    updated.append((target_date, moving_item["index"], rebuilt_moving))
    if old_image != new_image:
        image_renames.append((old_image, new_image))

    previous_date = target_date
    for item in remaining:
        if item["date"] < target_date:
            continue

        assigned_date = item["date"]
        if assigned_date <= previous_date:
            assigned_date = next_available_friday(previous_date)

        rebuilt, old_image, new_image = build_entry(item["entry"], assigned_date)
        updated.append((assigned_date, item["index"], rebuilt))
        if old_image != new_image:
            image_renames.append((old_image, new_image))
        previous_date = assigned_date

    updated.sort(key=lambda item: (item[0], item[1]))
    return [item[2] for item in updated], image_renames


def rename_images(images_dir, rename_pairs):
    pending = [(old_name, new_name) for old_name, new_name in rename_pairs if old_name and new_name and old_name != new_name]
    if not pending:
        return

    temp_moves = []
    for old_name, new_name in pending:
        old_path = os.path.join(images_dir, old_name)
        if not os.path.exists(old_path):
            raise FileNotFoundError(f"No existe la imagen '{old_name}' en '{images_dir}'.")

        temp_path = f"{old_path}.reorder-pildora-tmp-{uuid.uuid4().hex}"
        os.replace(old_path, temp_path)
        temp_moves.append((temp_path, os.path.join(images_dir, new_name)))

    for temp_path, final_path in temp_moves:
        os.replace(temp_path, final_path)


def write_data(path, data, pildoras):
    payload = {"pildoras": pildoras}
    data.update(payload)

    with open(path, "w", encoding="utf-8") as handle:
        yaml.safe_dump(
            data,
            handle,
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
            width=1000,
        )


def main():
    parser = argparse.ArgumentParser(description="Reordena una píldora y desplaza las posteriores si es necesario.")
    parser.add_argument("--pildora", required=True, help="Fecha actual de la píldora a mover (AAAA-MM-DD).")
    parser.add_argument("--fecha", required=True, help="Nueva fecha destino para la píldora (AAAA-MM-DD).")
    parser.add_argument("--data-file", default=DEFAULT_DATA_FILE, help="Ruta absoluta al data.yml.")
    parser.add_argument("--images-dir", default=DEFAULT_IMAGES_DIR, help="Ruta absoluta al directorio de imágenes.")
    args = parser.parse_args()

    data, pildoras = load_pildoras(args.data_file)
    reordered, image_renames = reorder_pildoras(pildoras, args.pildora, args.fecha)
    rename_images(args.images_dir, image_renames)
    write_data(args.data_file, data, reordered)

    print(f"Píldora '{args.pildora}' movida a '{args.fecha}'.")
    for old_name, new_name in image_renames:
        if old_name != new_name:
            print(f"Imagen renombrada: {old_name} -> {new_name}")


if __name__ == "__main__":
    main()
