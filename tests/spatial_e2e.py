"""Browser acceptance checks for the spatial Violet presentation.
Run from the repository root: python3 tests/spatial_e2e.py
Requires Python playwright and Chromium. External Three.js is intentionally optional;
the scene stays functional on Canvas2D when the module is unavailable.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/"
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
        for width, height in ((1440, 900), (390, 844)):
            page = browser.new_page(viewport={"width": width, "height": height})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(url)
            assert page.locator("#name-prompt").is_visible()
            page.locator("#skip-name").click()
            page.wait_for_function("window.__violetStudy.snapshot().qualified === true")
            assert page.locator("#name-prompt").is_hidden()
            page.locator("#continue").click()
            assert page.locator("#headline").inner_text().startswith("It began")
            page.locator("#explore").click()
            assert page.locator(".constellation-node").count() == 7
            page.locator('[aria-label="Explore workbench"]').click()
            assert "command is not" in page.locator("#headline").inner_text()
            page.locator("#depth").click()
            assert "browser-only carriage illustration" in page.locator("#caption").inner_text()
            page.locator("#observe").click()
            page.wait_for_function("window.__violetStudy.snapshot().mechanicsResult?.includes('TARGET REACHED')", timeout=10000)
            page.locator("#return").click()
            assert page.evaluate("window.__violetStudy.snapshot().index") == 1
            assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
            assert not errors, errors
            page.close()
        browser.close()
finally:
    server.shutdown()
print("Spatial interaction checks passed for desktop and phone viewports.")
