"""public/og.png を scripts/og.html から作る(1200x630)。 uv run --with playwright python scripts/build-og.py"""
import pathlib
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1200, "height": 630})
    pg.goto((here / "og.html").as_uri())
    pg.evaluate("document.fonts.ready")
    pg.screenshot(path=str(here.parent / "public" / "og.png"))
    b.close()
