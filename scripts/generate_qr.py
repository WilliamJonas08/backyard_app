"""Generate the QR code participants scan to open the app.

Usage::

    python scripts/generate_qr.py https://ton-app.example.com

Writes ``qr_code.png`` (and prints an ASCII version to the terminal). Print it
and stick it up on race day.
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import qrcode
except ImportError:  # pragma: no cover - helpful message when dep is missing
    sys.exit("Le module 'qrcode' est requis. Installe-le : pip install 'qrcode[pil]'")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/generate_qr.py <URL_DE_L_APP>")

    url = sys.argv[1]
    qr = qrcode.QRCode(border=2, box_size=10)
    qr.add_data(url)
    qr.make(fit=True)

    # ASCII preview in the terminal.
    qr.print_ascii(invert=True)

    output = Path(__file__).resolve().parent.parent / "qr_code.png"
    qr.make_image(fill_color="black", back_color="white").save(output)
    print(f"\nQR code enregistré : {output}\nURL encodée : {url}")


if __name__ == "__main__":
    main()
