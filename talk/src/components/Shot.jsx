import React from 'react'
import dims from '../data/shotDims.json'

/**
 * A screenshot of the real report, optionally cropped, with highlight boxes.
 *
 *   file   name in public/shots/ (its pixel size comes from data/shotDims.json)
 *   crop   [x0, y0, x1, y1] as fractions of the full image (default: whole image)
 *   width  | height | maxHeight   display size in slide pixels (aspect kept)
 *   marks  [{ box: [x0, y0, x1, y1], label, tone: 'error'|'warning'|'info'|'fixed', pos }]
 *          boxes are fractions of the FULL image, so they stay right whatever the crop.
 *   tone   'error' | 'warning' | 'info': outlines the whole crop (for a single tile of the report)
 */
export default function Shot({ file, crop = [0, 0, 1, 1], width, height, maxHeight, marks = [], caption, style, tone }) {
  const [W, H] = dims[file] || [2400, 1350]
  const [x0, y0, x1, y1] = crop
  const rw = (x1 - x0) * W
  const rh = (y1 - y0) * H
  let w = width
  let h
  if (w == null && height != null) {
    h = height
    w = (h * rw) / rh
  } else {
    w = w ?? 800
    h = (w * rh) / rw
  }
  if (maxHeight && h > maxHeight) {
    h = maxHeight
    w = (h * rw) / rh
  }
  const scale = w / rw
  const imgW = W * scale
  const imgH = H * scale
  const pct = (v, a, b) => `${((v - a) / (b - a)) * 100}%`

  return (
    <figure className={`shot ${tone ? `tone-${tone}` : ''}`} style={{ width: w, ...style }}>
      <div className="shot-frame" style={{ width: w, height: h }}>
        <img
          src={`shots/${file}`}
          alt={caption || file}
          draggable={false}
          style={{ width: imgW, height: imgH, left: -x0 * imgW, top: -y0 * imgH }}
        />
        {marks.map((m, i) => {
          const [a, b, c, d] = m.box
          return (
            <div
              key={i}
              className={`shot-mark ${m.tone || ''}`}
              style={{
                left: pct(a, x0, x1),
                top: pct(b, y0, y1),
                width: `${((c - a) / (x1 - x0)) * 100}%`,
                height: `${((d - b) / (y1 - y0)) * 100}%`,
              }}
            >
              {m.label && <span className={`lab ${m.pos || 'top'}`}>{m.label}</span>}
            </div>
          )
        })}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
