#!/usr/bin/env python3
"""
Build the hermes-agent sidecar binary using PyInstaller.

This script:
1. Locates the hermes-agent installation at ~/.hermes/hermes-agent
2. Runs PyInstaller to create a standalone binary
3. Renames it with the Tauri target-triple suffix
4. Copies it to src-tauri/binaries/

Usage:
    python scripts/build-sidecar.py
    python scripts/build-sidecar.py --onefile    # Single file (slower startup)
    python scripts/build-sidecar.py --dev        # Use dev wrapper instead
"""

import os
import sys
import shutil
import subprocess
import platform
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
BINARIES_DIR = PROJECT_DIR / "src-tauri" / "binaries"
HERMES_HOME = Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes")))
HERMES_AGENT_DIR = Path(os.environ.get("HERMES_AGENT_DIR", str(HERMES_HOME / "hermes-agent")))
HERMES_VENV = HERMES_AGENT_DIR / "venv"


def get_target_triple() -> str:
    result = subprocess.run(
        ["rustc", "--print", "host-tuple"],
        capture_output=True, text=True, check=True,
    )
    return result.stdout.strip()


def get_venv_python() -> Path:
    if sys.platform == "win32":
        return HERMES_VENV / "Scripts" / "python.exe"
    return HERMES_VENV / "bin" / "python"


def build_pyinstaller(onefile: bool = False, target_triple_override: str = None):
    venv_python = get_venv_python()
    if not venv_python.exists():
        print(f"Error: hermes-agent venv not found at {HERMES_VENV}")
        print("Install hermes-agent first:")
        print("  curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash")
        sys.exit(1)

    subprocess.run(
        [str(venv_python), "-m", "pip", "install", "pyinstaller"],
        check=True,
    )

    spec_content = generate_spec(onefile)
    spec_path = SCRIPT_DIR / "hermes-sidecar.spec"
    spec_path.write_text(spec_content)
    print(f"Generated spec: {spec_path}")

    subprocess.run(
        [str(venv_python), "-m", "PyInstaller", str(spec_path), "--noconfirm"],
        cwd=str(HERMES_AGENT_DIR),
        check=True,
    )

    target_triple = target_triple_override or get_target_triple()
    ext = ".exe" if sys.platform == "win32" else ""
    src_name = f"hermes-sidecar{ext}"

    if onefile:
        src = HERMES_AGENT_DIR / "dist" / src_name
    else:
        src = HERMES_AGENT_DIR / "dist" / "hermes-sidecar" / src_name

    if not src.exists():
        print(f"Error: PyInstaller output not found at {src}")
        sys.exit(1)

    BINARIES_DIR.mkdir(parents=True, exist_ok=True)
    dest = BINARIES_DIR / f"hermes-sidecar-{target_triple}{ext}"

    if onefile:
        shutil.copy2(src, dest)
    else:
        dest_dir = BINARIES_DIR / f"hermes-sidecar-{target_triple}"
        if dest_dir.exists():
            shutil.rmtree(dest_dir)
        shutil.copytree(HERMES_AGENT_DIR / "dist" / "hermes-sidecar", dest_dir)
        main_bin = dest_dir / src_name
        if main_bin.exists():
            shutil.copy2(main_bin, dest)

    print(f"Sidecar binary: {dest}")
    print(f"Size: {dest.stat().st_size / 1024 / 1024:.1f} MB")


def generate_spec(onefile: bool) -> str:
    agent_dir = str(HERMES_AGENT_DIR).replace("\\", "\\\\")
    mode = "onefile" if onefile else "onedir"

    hidden_imports = [
        "openai", "anthropic", "httpx", "pydantic", "rich",
        "prompt_toolkit", "dotenv", "yaml", "fire", "tenacity",
        "requests", "jinja2", "exa_py", "firecrawl", "edge_tts",
        "jwt", "croniter", "telegram", "discord", "aiohttp",
        "hermes_cli", "hermes_cli.main", "agent", "tools",
        "gateway", "cron", "plugins",
    ]

    hidden_str = ",\n        ".join(f'"{h}"' for h in hidden_imports)

    return f'''# -*- mode: python ; coding: utf-8 -*-
# Auto-generated PyInstaller spec for hermes-agent sidecar

import os
import sys

block_cipher = None
agent_dir = r"{agent_dir}"

a = Analysis(
    [os.path.join(agent_dir, "run_agent.py")],
    pathex=[agent_dir],
    binaries=[],
    datas=[
        (os.path.join(agent_dir, "skills"), "skills"),
        (os.path.join(agent_dir, "optional-skills"), "optional-skills"),
        (os.path.join(agent_dir, "agent"), "agent"),
        (os.path.join(agent_dir, "tools"), "tools"),
        (os.path.join(agent_dir, "hermes_cli"), "hermes_cli"),
        (os.path.join(agent_dir, "gateway"), "gateway"),
        (os.path.join(agent_dir, "cron"), "cron"),
        (os.path.join(agent_dir, "plugins"), "plugins"),
    ],
    hiddenimports=[
        {hidden_str}
    ],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[
        "tkinter", "unittest", "test", "xmlrpc",
        "pydoc", "doctest", "lib2to3",
    ],
    noarchive=False,
    optimize=1,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

{"exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name='hermes-sidecar', debug=False, bootloader_ignore_signals=False, strip=True, upx=True, console=True)" if onefile else "exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='hermes-sidecar', debug=False, bootloader_ignore_signals=False, strip=True, upx=True, console=True)"}

{"" if onefile else "coll = COLLECT(exe, a.binaries, a.datas, strip=True, upx=True, name='hermes-sidecar')"}
'''


def build_dev_wrapper():
    """Create a dev wrapper that delegates to the installed hermes venv."""
    target_triple = get_target_triple()
    ext = ".exe" if sys.platform == "win32" else ""
    BINARIES_DIR.mkdir(parents=True, exist_ok=True)
    dest = BINARIES_DIR / f"hermes-sidecar-{target_triple}{ext}"

    if sys.platform == "win32":
        dest.write_text(f'''@echo off
set HERMES_VENV=%USERPROFILE%\\.hermes\\hermes-agent\\venv
if not exist "%HERMES_VENV%" (
    echo {{"error": "hermes-agent not installed"}} >&2
    exit /b 1
)
"%HERMES_VENV%\\Scripts\\python.exe" -u %*
''')
    else:
        dest.write_text(f'''#!/bin/bash
HERMES_VENV="$HOME/.hermes/hermes-agent/venv"
if [ ! -d "$HERMES_VENV" ]; then
    echo '{{"error": "hermes-agent not installed"}}' >&2
    exit 1
fi
exec "$HERMES_VENV/bin/python" -u "$@"
''')
        dest.chmod(0o755)

    print(f"Dev sidecar wrapper: {dest}")


if __name__ == "__main__":
    args = sys.argv[1:]

    target_triple_override = None
    for i, arg in enumerate(args):
        if arg == "--target-triple" and i + 1 < len(args):
            target_triple_override = args[i + 1]

    if "--dev" in args:
        build_dev_wrapper()
    elif "--onefile" in args:
        build_pyinstaller(onefile=True, target_triple_override=target_triple_override)
    else:
        build_pyinstaller(onefile=False, target_triple_override=target_triple_override)
