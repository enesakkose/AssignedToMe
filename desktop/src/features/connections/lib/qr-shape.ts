import QRCode from 'qrcode';

/** A rounded rectangle as path data, with its own radius per corner: top-left, top-right, bottom-right, bottom-left. */
function roundRect(x: number, y: number, w: number, h: number, [tl, tr, br, bl]: readonly number[]) {
  const arc = (r: number, dx: number, dy: number) => (r ? `a${r} ${r} 0 0 1 ${dx} ${dy}` : '');
  return (
    `M${x + tl} ${y}h${w - tl - tr}${arc(tr, tr, tr)}v${h - tr - br}${arc(br, -br, br)}` +
    `h${br + bl - w}${arc(bl, -bl, -bl)}v${tl + bl - h}${arc(tl, tl, -tl)}z`
  );
}
const all = (r: number) => [r, r, r, r] as const;

/**
 * The QR drawn in the app's own style: soft square modules and one-piece rounded finder eyes. Geometry only (path data
 * in module units), so it can be rendered and also checked by a decoder.
 */
export function qrShape(text: string) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'L' });
  const size = modules.size;
  // The three 7×7 finder patterns, drawn as eyes instead of single modules.
  const eyes = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ] as const;
  const inEye = (x: number, y: number) => eyes.some(([ex, ey]) => x >= ex && x < ex + 7 && y >= ey && y < ey + 7);

  // Each dark module fills its cell and rounds only the corners where it has no dark neighbour on either side, so
  // touching modules flow into soft shapes instead of a grid of dots: calmer to look at, and full-size for cameras.
  const dark = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && modules.get(y, x) && !inEye(x, y);
  const R = 0.5;
  let dots = '';
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (!dark(x, y)) continue;
      const up = dark(x, y - 1), down = dark(x, y + 1), left = dark(x - 1, y), right = dark(x + 1, y);
      dots += roundRect(x, y, 1, 1, [up || left ? 0 : R, up || right ? 0 : R, down || right ? 0 : R, down || left ? 0 : R]);
    }

  let eyePath = '';
  for (const [x, y] of eyes) {
    // Outer ring (7×7 minus 5×5, even-odd) and the 3×3 pupil.
    eyePath += roundRect(x, y, 7, 7, all(2)) + roundRect(x + 1, y + 1, 5, 5, all(1.4)) + roundRect(x + 2, y + 2, 3, 3, all(0.9));
  }
  return { size, dots, eyes: eyePath };
}
