// Best-effort table of current-generation iPhone/iPad viewport sizes for
// `apple-touch-startup-image` <link> media queries. Values are the
// documented CSS viewport size (device-width/device-height) and pixel
// ratio for each device class; the actual startup PNG is rendered at
// width*scale x height*scale.
//
// Per ARAWAN-implementation-plan.md §12, Apple startup images "require
// appropriate dimensions and actual-device verification; a single
// universal image is insufficient." This table is the best-effort MVP set
// (current iPhone/iPad families, portrait + landscape) — real-device
// verification on physical hardware remains an outstanding follow-up
// noted in README.md, not something this table can self-certify.
export const APPLE_SPLASH_DEVICES = [
  { id: 'iphone-se', width: 375, height: 667, scale: 2 },
  { id: 'iphone-standard', width: 390, height: 844, scale: 3 },
  { id: 'iphone-plus', width: 428, height: 926, scale: 3 },
  { id: 'iphone-pro', width: 393, height: 852, scale: 3 },
  { id: 'iphone-pro-max', width: 430, height: 932, scale: 3 },
  { id: 'ipad-mini', width: 744, height: 1133, scale: 2 },
  { id: 'ipad-air', width: 820, height: 1180, scale: 2 },
  { id: 'ipad-pro-11', width: 834, height: 1194, scale: 2 },
  { id: 'ipad-pro-13', width: 1024, height: 1366, scale: 2 },
]

/** Builds the { orientation, media, id, file } entries for both orientations of a device. */
export function splashVariants() {
  const out = []
  for (const d of APPLE_SPLASH_DEVICES) {
    out.push({
      id: `${d.id}-portrait`,
      file: `/splash/${d.id}-portrait.png`,
      pixelWidth: d.width * d.scale,
      pixelHeight: d.height * d.scale,
      media: `(device-width: ${d.width}px) and (device-height: ${d.height}px) and (-webkit-device-pixel-ratio: ${d.scale}) and (orientation: portrait)`,
    })
    out.push({
      id: `${d.id}-landscape`,
      file: `/splash/${d.id}-landscape.png`,
      pixelWidth: d.height * d.scale,
      pixelHeight: d.width * d.scale,
      media: `(device-width: ${d.width}px) and (device-height: ${d.height}px) and (-webkit-device-pixel-ratio: ${d.scale}) and (orientation: landscape)`,
    })
  }
  return out
}
