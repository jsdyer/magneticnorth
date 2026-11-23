"""Exercise the built magnetic calculator at its project subpath in Chromium."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import shutil
import tempfile
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    screenshots = ROOT / "browser-checks"
    screenshots.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        shutil.copytree(ROOT / "dist", Path(temporary) / "magneticnorth")
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=temporary))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page(viewport={"width": 1280, "height": 1000})
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{server.server_port}/magneticnorth/")
                expect(page.locator("#calculate")).to_be_enabled()
                page.locator("#date").fill("2026-11-23")
                page.locator("#calculate").click()
                expect(page.locator("#declination")).to_contain_text("E")
                expect(page.locator("#status")).to_contain_text("Calculated locally")
                assert len(page.locator("#place-comparison tr").all()) == 4
                page.get_by_role("button", name="Halifax, NS", exact=True).click()
                expect(page.locator("#declination")).to_contain_text("W")
                # Any valid input, beyond the initial place list.
                page.locator("#latitude").fill("43.6532")
                page.locator("#longitude").fill("-79.3832")
                page.locator("#date").fill("2028-07-02")
                page.locator("#calculate").click()
                expect(page.locator("#result-place")).to_contain_text("43.6532")
                expect(page.locator("#declination")).to_contain_text("W")
                page.locator("#bearing").fill("90")
                expect(page.locator("#bearing-result")).to_contain_text("magnetic")
                page.locator("#bearing-from").select_option("magnetic")
                expect(page.locator("#bearing-result")).to_contain_text("true")
                page.get_by_text("Inspect model components", exact=True).click()
                expect(page.locator("#components")).to_contain_text("Down into Earth")
                with page.expect_download() as download_info:
                    page.locator("#save").click()
                receipt = json.loads(Path(download_info.value.path()).read_text())
                assert receipt["schema"] == "coolcode.magneticnorth.v1"
                assert receipt["result"]["latitude"] == 43.6532
                assert receipt["result"]["date"] == "2028-07-02"
                page.locator("#date").fill("2030-01-01")
                assert page.locator("#date").evaluate("node => !node.validity.valid")
                page.locator("#date").fill("2026-11-23")
                page.locator("#latitude").fill("90")
                page.locator("#calculate").click()
                expect(page.locator("#warning")).to_contain_text("geographic pole")
                expect(page.locator("#bearing-result")).to_have_text("No reliable conversion")
                page.get_by_role("button", name="Langley, BC", exact=True).click()
                page.screenshot(path=str(screenshots / "desktop.png"), full_page=True)
                page.set_viewport_size({"width": 390, "height": 844})
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), page.evaluate("({page:document.documentElement.scrollWidth,view:innerWidth})")
                page.screenshot(path=str(screenshots / "mobile.png"), full_page=True)
                assert not errors, errors
                browser.close()
            print("Browser checks passed: model, custom place/date, conversions, export, poles and mobile")
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
