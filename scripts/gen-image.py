#!/usr/bin/env python3
from __future__ import annotations
"""Generate an image using Azure OpenAI's image generation API."""

import argparse
import base64
import os
from pathlib import Path
import subprocess
import sys

DEFAULT_ENDPOINT = "https://quivr-sweden-central-resource.openai.azure.com/openai/v1"
DEFAULT_DEPLOYMENT = "gpt-image-2-1"
LOCAL_ENV_FILES = (
    Path(__file__).resolve().parents[1] / ".env.local",
    Path.home() / ".config" / "vibe_generate-image" / ".env",
)

ASPECT_TO_SIZE = {
    "1:1": "1024x1024",
    "16:9": "1536x1024",
    "4:3": "1536x1024",
    "9:16": "1024x1536",
    "3:4": "1024x1536",
}

VARIANT_DIRECTIONS = (
    "premium editorial composition, single strong focal point, strong negative space",
    "useful infographic-like layout, clear hierarchy, structured flow, restrained detail",
    "cinematic product-grade 3D render, precise lighting, polished technical object",
    "abstract systems map, modular panels, visible cause-and-effect structure",
    "high-contrast magazine cover direction, bold silhouette, minimal clutter",
    "isometric technical cutaway, layered components, readable at article width",
)


def load_local_env_files() -> None:
    """Load private local credentials without requiring shell exports."""
    for env_file in LOCAL_ENV_FILES:
        if not env_file.exists():
            continue
        for raw_line in env_file.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def resolve_api_key() -> str:
    load_local_env_files()
    api_key = os.environ.get("AZURE_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print(
            "Missing API key. Set AZURE_OPENAI_API_KEY, OPENAI_API_KEY, "
            "or add AZURE_OPENAI_API_KEY to .env.local next to the skill.",
            file=sys.stderr,
        )
        sys.exit(1)
    return api_key


def resolve_output_path(output_path: str, index: int, count: int) -> Path:
    output = Path(output_path)
    if count == 1:
        return output

    output_text = str(output)
    if "{i}" in output_text or "{index}" in output_text or "{n}" in output_text:
        return Path(output_text.format(i=f"{index:02d}", index=index, n=count))

    suffix = output.suffix or ".png"
    stem = output.stem if output.suffix else output.name
    return output.with_name(f"{stem}-{index:02d}{suffix}")


def prompt_for_variant(prompt: str, index: int, count: int, diversify: bool) -> str:
    if count == 1 or not diversify:
        return prompt
    direction = VARIANT_DIRECTIONS[(index - 1) % len(VARIANT_DIRECTIONS)]
    return (
        f"{prompt}\n\n"
        f"Variation {index} of {count}. Creative direction: {direction}. "
        "Make this version visually distinct from the other variations while preserving the core brief."
    )


def default_log_path(output_path: str) -> Path:
    output = Path(output_path)
    parent = output.parent if str(output.parent) else Path(".")
    stem = output.stem if output.suffix else output.name
    return parent / f"{stem}.generate.log"


def run_in_background(args: argparse.Namespace) -> None:
    validate_count(args.count, diversify=not args.same_prompt)
    log_path = Path(args.log) if args.log else default_log_path(args.output)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    command = [
        sys.executable,
        str(Path(__file__).resolve()),
        args.prompt,
        "-o",
        args.output,
        "-a",
        args.aspect_ratio,
        "--endpoint",
        args.endpoint,
        "--deployment",
        args.deployment,
        "--count",
        str(args.count),
    ]
    if args.size:
        command.extend(["--size", args.size])
    for input_image in args.input_image:
        command.extend(["--input-image", input_image])
    if args.input_fidelity:
        command.extend(["--input-fidelity", args.input_fidelity])
    if args.output_format:
        command.extend(["--output-format", args.output_format])
    if args.same_prompt:
        command.append("--same-prompt")

    with log_path.open("ab") as log_file:
        process = subprocess.Popen(
            command,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )

    pid_path = log_path.with_suffix(".pid")
    pid_path.write_text(str(process.pid))
    print(f"Background image generation started. PID: {process.pid}")
    print(f"Log: {log_path}")
    print(f"PID file: {pid_path}")


def generate(
    prompt: str,
    output_path: str,
    aspect_ratio: str = "16:9",
    size: str | None = None,
    endpoint: str = DEFAULT_ENDPOINT,
    deployment: str = DEFAULT_DEPLOYMENT,
    count: int = 1,
    diversify: bool = True,
) -> None:
    validate_count(count, diversify)

    try:
        from openai import OpenAI
    except ImportError:
        print("Missing dependency: install the openai Python package.", file=sys.stderr)
        sys.exit(1)

    image_size = size or ASPECT_TO_SIZE[aspect_ratio]
    client = OpenAI(base_url=endpoint, api_key=resolve_api_key())

    for index in range(1, count + 1):
        variant_prompt = prompt_for_variant(prompt, index, count, diversify)
        output = resolve_output_path(output_path, index, count)

        try:
            img = client.images.generate(
                model=deployment,
                prompt=variant_prompt,
                n=1,
                size=image_size,
            )
        except Exception as exc:
            print(f"API error on image {index}/{count}: {exc}", file=sys.stderr)
            sys.exit(1)

        if not img.data or not getattr(img.data[0], "b64_json", None):
            print(f"No base64 image in response for image {index}/{count}.", file=sys.stderr)
            sys.exit(1)

        image_bytes = base64.b64decode(img.data[0].b64_json)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(image_bytes)
        print(f"Image {index}/{count} saved to {output}")


def azure_edit_url(endpoint: str, deployment: str, api_version: str) -> str:
    root = endpoint.replace("/openai/v1", "").rstrip("/")
    return f"{root}/openai/deployments/{deployment}/images/edits?api-version={api_version}"


def edit_with_input_images(
    prompt: str,
    output_path: str,
    input_images: list[str],
    aspect_ratio: str = "16:9",
    size: str | None = None,
    endpoint: str = DEFAULT_ENDPOINT,
    deployment: str = DEFAULT_DEPLOYMENT,
    input_fidelity: str = "high",
    output_format: str = "png",
    api_version: str = "2025-04-01-preview",
    count: int = 1,
    diversify: bool = True,
) -> None:
    """Use Azure's multipart image edit API with one or more reference images."""
    validate_count(count, diversify)

    try:
        import requests
    except ImportError:
        print("Missing dependency: install the requests Python package.", file=sys.stderr)
        sys.exit(1)

    image_size = size or ASPECT_TO_SIZE[aspect_ratio]
    url = azure_edit_url(endpoint, deployment, api_version)
    validated_inputs = []

    for raw_path in input_images:
        image_path = Path(raw_path)
        if not image_path.exists():
            print(f"Input image not found: {image_path}", file=sys.stderr)
            sys.exit(1)
        if image_path.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
            print(
                f"Azure image edits require PNG or JPG input images: {image_path}",
                file=sys.stderr,
            )
            sys.exit(1)
        media_type = "image/jpeg" if image_path.suffix.lower() in {".jpg", ".jpeg"} else "image/png"
        validated_inputs.append((image_path, media_type))

    for index in range(1, count + 1):
        variant_prompt = prompt_for_variant(prompt, index, count, diversify)
        output = resolve_output_path(output_path, index, count)
        opened_files = []
        files = []

        for image_path, media_type in validated_inputs:
            handle = image_path.open("rb")
            opened_files.append(handle)
            files.append(("image[]", (image_path.name, handle, media_type)))

        data = {
            "prompt": variant_prompt,
            "size": image_size,
            "n": "1",
            "quality": __import__("os").environ.get("IMG_QUALITY", "high"),
            "input_fidelity": input_fidelity,
            "output_format": output_format,
        }

        try:
            response = requests.post(
                url,
                headers={"api-key": resolve_api_key()},
                files=files,
                data=data,
                timeout=540,
            )
        finally:
            for handle in opened_files:
                handle.close()

        if not response.ok:
            print(
                f"API error on edited image {index}/{count}: "
                f"{response.status_code} {response.text}",
                file=sys.stderr,
            )
            sys.exit(1)

        payload = response.json()
        try:
            b64_json = payload["data"][0]["b64_json"]
        except (KeyError, IndexError, TypeError):
            print(f"No base64 image in edit response for image {index}/{count}.", file=sys.stderr)
            sys.exit(1)

        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(base64.b64decode(b64_json))
        print(f"Edited image {index}/{count} saved to {output}")


def validate_count(count: int, diversify: bool) -> None:
    if count < 1 or count > 10:
        print("Count must be between 1 and 10.", file=sys.stderr)
        sys.exit(1)
    if not diversify and count > 2:
        print(
            "Refusing to generate more than 2 images with the exact same prompt. "
            "Remove --same-prompt to generate diversified candidates.",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate image with Azure OpenAI")
    parser.add_argument("prompt", help="Image generation prompt")
    parser.add_argument("-o", "--output", required=True, help="Output file path")
    parser.add_argument(
        "-a", "--aspect-ratio", default="16:9",
        choices=["16:9", "1:1", "9:16", "4:3", "3:4"],
        help="Aspect ratio used to infer size when --size is omitted (default: 16:9)",
    )
    parser.add_argument(
        "-s",
        "--size",
        choices=["1024x1024", "1536x1024", "1024x1536"],
        help="Exact image size. Overrides --aspect-ratio.",
    )
    parser.add_argument(
        "--endpoint",
        default=os.environ.get("AZURE_OPENAI_IMAGE_ENDPOINT", DEFAULT_ENDPOINT),
        help="Azure OpenAI endpoint base URL",
    )
    parser.add_argument(
        "--deployment",
        default=os.environ.get("AZURE_OPENAI_IMAGE_DEPLOYMENT", DEFAULT_DEPLOYMENT),
        help="Azure OpenAI image deployment name",
    )
    parser.add_argument(
        "-n",
        "--count",
        type=int,
        default=1,
        help="Number of different images to generate in one run (1-10).",
    )
    parser.add_argument(
        "--same-prompt",
        action="store_true",
        help="Generate up to 2 images with the exact same prompt instead of adding variant directions.",
    )
    parser.add_argument(
        "--background",
        action="store_true",
        help="Start generation in a detached background process and return immediately.",
    )
    parser.add_argument(
        "--log",
        help="Log file for --background mode. Defaults to <output-stem>.generate.log.",
    )
    parser.add_argument(
        "--input-image",
        action="append",
        default=[],
        help="PNG/JPG reference image for Azure image edits. Repeat for multiple images.",
    )
    parser.add_argument(
        "--input-fidelity",
        default="high",
        choices=["high", "low"],
        help="How strongly the edit should preserve input image features (default: high).",
    )
    parser.add_argument(
        "--output-format",
        default="png",
        choices=["png", "jpeg"],
        help="Output format for Azure image edits (default: png).",
    )
    args = parser.parse_args()
    if args.background:
        run_in_background(args)
        sys.exit(0)

    if args.input_image:
        edit_with_input_images(
            prompt=args.prompt,
            output_path=args.output,
            input_images=args.input_image,
            aspect_ratio=args.aspect_ratio,
            size=args.size,
            endpoint=args.endpoint,
            deployment=args.deployment,
            input_fidelity=args.input_fidelity,
            output_format=args.output_format,
            count=args.count,
            diversify=not args.same_prompt,
        )
    else:
        generate(
            prompt=args.prompt,
            output_path=args.output,
            aspect_ratio=args.aspect_ratio,
            size=args.size,
            endpoint=args.endpoint,
            deployment=args.deployment,
            count=args.count,
            diversify=not args.same_prompt,
        )
