from __future__ import annotations

import os
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "frontend"
PAGES = SOURCE / "pages"
DIST = ROOT / "dist"


def reset_dist() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True, exist_ok=True)


def copy_tree(name: str) -> None:
    source_dir = SOURCE / name
    if source_dir.exists():
        shutil.copytree(source_dir, DIST / name)


def rewrite_html(content: str) -> str:
    replacements = {
        'href="../css/': 'href="css/',
        'src="../js/': 'src="js/',
        'src="../assets/': 'src="assets/',
        'src="../script/': 'src="script/',
        'src="biblioDrift_favicon.png"': 'src="assets/images/biblioDrift_favicon.png"',
        'href="style.css"': 'href="css/style.css"',
        'href="style-responsive.css"': 'href="css/style-responsive.css"',
        'src="config.js"': 'src="js/config.js"',
        'src="footer.js"': 'src="js/footer.js"',
        'src="app.js"': 'src="js/app.js"',
        'src="chat.js"': 'src="js/chat.js"',
        'src="library-3d.js"': 'src="js/library-3d.js"',
        'src="script/header-scroll.js"': 'src="script/header-scroll.js"',
        'src="js/header-scroll.js"': 'src="script/header-scroll.js"',
        '../assets/biblioDrift_favicon.png': 'assets/images/biblioDrift_favicon.png',
    }

    for pattern, replacement in replacements.items():
        content = content.replace(pattern, replacement)
    return content


def build_html() -> None:
    for html_file in PAGES.glob("*.html"):
        target_file = DIST / html_file.name
        content = html_file.read_text(encoding="utf-8")
        target_file.write_text(rewrite_html(content), encoding="utf-8")


def inject_api_base_override() -> None:
    """Optional Netlify build env MOOD_API_BASE → runtime override in dist config.js."""
    api_base = os.getenv("MOOD_API_BASE", "").strip()
    if not api_base:
        return
    config_path = DIST / "js" / "config.js"
    if not config_path.exists():
        return
    snippet = f'window.__MOOD_API_BASE_OVERRIDE__ = {api_base!r};\n'
    content = config_path.read_text(encoding="utf-8")
    config_path.write_text(snippet + content, encoding="utf-8")


def main() -> None:
    reset_dist()
    for folder in ("css", "js", "assets", "script"):
        copy_tree(folder)
    build_html()
    inject_api_base_override()


if __name__ == "__main__":
    main()