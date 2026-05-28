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
        'href="../css/': 'href="/css/',
        'src="../js/': 'src="/js/',
        'src="../assets/': 'src="/assets/',
        'src="../script/': 'src="/script/',
        'src="biblioDrift_favicon.png"': 'src="/assets/images/biblioDrift_favicon.png"',
        'href="style.css"': 'href="/css/style.css"',
        'href="style-responsive.css"': 'href="/css/style-responsive.css"',
        'src="config.js"': 'src="/js/config.js"',
        'src="footer.js"': 'src="/js/footer.js"',
        'src="app.js"': 'src="/js/app.js"',
        'src="chat.js"': 'src="/js/chat.js"',
        'src="library-3d.js"': 'src="/js/library-3d.js"',
        'src="script/header-scroll.js"': 'src="/script/header-scroll.js"',
        'src="js/header-scroll.js"': 'src="/script/header-scroll.js"',
        '../assets/biblioDrift_favicon.png': '/assets/images/biblioDrift_favicon.png',
        'href="../manifest.json"': 'href="/manifest.json"',
        'href="/manifest.json"': 'href="/manifest.json"',
    }

    for pattern, replacement in replacements.items():
        content = content.replace(pattern, replacement)
    return content


def build_html() -> None:
    for html_file in PAGES.glob("*.html"):
        target_file = DIST / html_file.name
        content = html_file.read_text(encoding="utf-8")
        target_file.write_text(rewrite_html(content), encoding="utf-8")


def write_clean_route_redirects() -> None:
    redirects = [
        "/app /app.html 200",
        "/chat /chat.html 200",
        "/auth /auth.html 200",
        "/library /library.html 200",
        "/vault /vault.html 200",
        "/profile /profile.html 200",
        "/privacy-policy /privacy-policy.html 200",
        "/terms-and-conditions /terms-and-conditions.html 200",
        "/request-book /request-book.html 200",
        "/contributors /contributors.html 200",
        "/contributing /contributing.html 200",
        "/community-stories /community-stories.html 200",
    ]
    (DIST / "_redirects").write_text("\n".join(redirects) + "\n", encoding="utf-8")


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
        
    manifest_src = SOURCE / "manifest.json"
    if manifest_src.exists():
        shutil.copy2(manifest_src, DIST / "manifest.json")
        
    build_html()
    write_clean_route_redirects()
    inject_api_base_override()


if __name__ == "__main__":
    main()
