"""Package the fully fictional demo with AI illustrations and public calendar data."""
from pathlib import Path
import re
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "artifacts"
OUTPUT.mkdir(exist_ok=True)
ROOT_FILES = {
    "package.json", "package-lock.json", "index.html", "tsconfig.json",
    "vite.config.ts", "vitest.config.ts", "playwright.config.ts",
    "tailwind.config.cjs", "postcss.config.cjs", "README.md", "AGENTS.md",
    ".gitignore", "Start Demo.command",
}
SCREENSHOTS = {
    "desktop-dark.png", "desktop-light.png", "viewport-375.png",
    "trend-overlay.png", "products.png", "materials.png", "mobile-material.png",
    "material-preview.png", "mobile-preview.png", "search.png", "search-mobile.png",
}
source_files = []
for file in ROOT.rglob("*"):
    if not file.is_file():
        continue
    rel = file.relative_to(ROOT)
    if len(rel.parts) == 1 and file.name in ROOT_FILES:
        source_files.append(file)
    elif rel.parts[0] in {"src", "scripts", "docs", "tests", "public"}:
        if "screenshots" in rel.parts and file.name not in SCREENSHOTS:
            continue
        if "__pycache__" not in rel.parts and file.name != ".DS_Store":
            source_files.append(file)

source_zip = OUTPUT / "sea-trend-demo-source.zip"
with ZipFile(source_zip, "w", ZIP_DEFLATED) as archive:
    for file in sorted(source_files):
        archive.write(file, Path("trend-calendar-demo") / file.relative_to(ROOT))

build = ROOT / "dist"
if not (build / "index.html").exists():
    raise SystemExit("Run npm run build before packaging.")
static_zip = OUTPUT / "sea-trend-demo-static.zip"
with ZipFile(static_zip, "w", ZIP_DEFLATED) as archive:
    for file in sorted(build.rglob("*")):
        if file.is_file():
            archive.write(file, file.relative_to(build))

for file in [source_zip, static_zip]:
    with ZipFile(file) as archive:
        if archive.testzip() is not None:
            raise SystemExit("ZIP integrity check failed.")
        retired = re.compile(
            r"(product-images|video-ids|material-covers|category-labels|materialCover)",
            re.IGNORECASE,
        )
        original_url = re.compile(
            rb"https?://[^\s\"']*(?:ibyteimg|tiktokcdn|tiktok-row|larkoffice)",
            re.IGNORECASE,
        )
        for info in archive.infolist():
            if retired.search(info.filename):
                raise SystemExit(f"Retired media file found in ZIP: {info.filename}")
            if info.file_size <= 10_000_000 and original_url.search(archive.read(info)):
                raise SystemExit(f"Original media or internal URL found in ZIP: {info.filename}")
        print(f"{file.name}: {len(archive.namelist())} files, {file.stat().st_size:,} bytes")
