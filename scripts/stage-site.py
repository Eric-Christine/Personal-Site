"""Build the hosting directory from the reviewed public-file manifest."""
import argparse
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("host", choices=["firebase", "hostgator"])
host = parser.parse_args().host
root = Path(__file__).resolve().parents[1]
output = root / ".site-build" / host
manifest = (root / "scripts/public-files.txt").read_text().splitlines()
if output.exists():
    shutil.rmtree(output)
for entry in manifest:
    source = root / entry
    if host == "firebase" and (entry == ".htaccess" or source.suffix == ".php"):
        continue  # Firebase Hosting serves static bytes.
    target = output / entry
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
