#!/usr/bin/env python3
"""Generate PWA icons (pure stdlib, no PIL): gradient background + heart."""
import struct, zlib, os

def write_png(path, w, h, rows):
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    raw = b''.join(b'\x00' + bytes(row) for row in rows)
    with open(path, 'wb') as f:
        f.write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def in_heart(nx, ny):
    # implicit heart: (x^2 + y^2 - 1)^3 - x^2*y^3 <= 0  (y up)
    x, y = nx * 1.25, -ny * 1.25 + 0.05
    v = (x * x + y * y - 1) ** 3 - x * x * y ** 3
    return v <= 0

def make(size, path):
    top, bottom = (124, 77, 255), (255, 95, 162)   # purple -> pink
    gold = (255, 210, 63)
    rows = []
    cx, cy = size / 2, size / 2
    r_heart = size * 0.30  # fits maskable safe zone
    for j in range(size):
        row = []
        base = lerp(top, bottom, j / (size - 1))
        for i in range(size):
            nx, ny = (i - cx) / r_heart, (j - cy) / r_heart
            if in_heart(nx, ny):
                # subtle vertical shade on the heart
                c = lerp((255, 235, 160), gold, min(1, max(0, (ny + 1.2) / 2.4)))
            else:
                c = base
            row += [c[0], c[1], c[2], 255]
        rows.append(row)
    write_png(path, size, size, rows)
    print('wrote', path)

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    icons = os.path.join(here, '..', 'icons')
    os.makedirs(icons, exist_ok=True)
    for s, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'icon-180.png')]:
        make(s, os.path.join(icons, name))
