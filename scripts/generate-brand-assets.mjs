// Generates every PWA/brand asset from the single delivered raster logo
// (spec §4/§12). Run once and commit the output:
//   node scripts/generate-brand-assets.mjs <path-to-arawan-logo.png>
//
// The source is a square image: a green emblem (capital A + rising sun +
// progress sweep) above the ARAWAN wordmark, on an off-white background
// that already matches the --color-canvas token. This script:
//   1. Detects the emblem band and the wordmark band by scanning rows for
//      non-background "ink" (no hand-picked crop coordinates).
//   2. Emits emblem-only icons (192/512/maskable-512/apple-touch/favicon).
//   3. Emits apple-touch-startup-image PNGs with the full logo (emblem +
//      wordmark) centered on each device's real canvas size.
//   4. Copies the untouched source into public/brand/ for the login page
//      and first-launch use (spec: "use the full logo on first launch and
//      sign-in").
//
// Apple startup image dimensions are best-effort (see
// config/apple-splash-devices.mjs) -- real-device verification remains an
// outstanding follow-up, not something this script can self-certify.
import { mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { APPLE_SPLASH_DEVICES } from '../config/apple-splash-devices.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CANVAS = { r: 247, g: 248, b: 245 } // --color-canvas #F7F8F5
const INK_THRESHOLD = 24 // per-channel distance from the sampled background to count as "content"

const sourcePath = process.argv[2]
if (!sourcePath) {
  console.error('Usage: node scripts/generate-brand-assets.mjs <path-to-arawan-logo.png>')
  process.exit(1)
}

async function main() {
  const { data, info } = await sharp(sourcePath).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const bg = samplePixel(data, width, channels, 0, 0)

  const rowHasInk = (y) => {
    for (let x = 0; x < width; x += 2) {
      if (pixelDistance(samplePixel(data, width, channels, x, y), bg) > INK_THRESHOLD) return true
    }
    return false
  }
  const bands = findBands(height, rowHasInk)
  if (bands.length < 2) {
    throw new Error(`Expected 2 ink bands (emblem, wordmark), found ${bands.length}. Adjust INK_THRESHOLD.`)
  }
  const emblemBand = bands[0]
  const wordmarkBand = bands[bands.length - 1]

  const emblemBox = tightBBox(data, width, channels, bg, emblemBand.start, emblemBand.end)
  const fullLogoBox = tightBBox(data, width, channels, bg, emblemBand.start, wordmarkBand.end)

  console.log('Detected emblem band', emblemBand, 'bbox', emblemBox)
  console.log('Detected wordmark band', wordmarkBand)
  console.log('Full logo bbox', fullLogoBox)

  const source = sharp(sourcePath)
  const emblem = source.clone().extract(boxToRegion(emblemBox))
  const fullLogo = source.clone().extract(boxToRegion(fullLogoBox))

  await mkdir(path.join(ROOT, 'public/icons'), { recursive: true })
  await mkdir(path.join(ROOT, 'public/splash'), { recursive: true })
  await mkdir(path.join(ROOT, 'public/brand'), { recursive: true })

  // --- App icons: emblem only, per spec "do not compress the full
  // wordmark into a tiny app icon". ---
  await composeOnCanvas(emblem, 192, 192, 0.72, path.join(ROOT, 'public/icons/icon-192.png'))
  await composeOnCanvas(emblem, 512, 512, 0.72, path.join(ROOT, 'public/icons/icon-512.png'))
  // Maskable: OS may crop to a circle/squircle -- keep extra margin inside the safe zone.
  await composeOnCanvas(emblem, 512, 512, 0.58, path.join(ROOT, 'public/icons/icon-maskable-512.png'))
  await composeOnCanvas(emblem, 180, 180, 0.72, path.join(ROOT, 'public/icons/apple-touch-icon-180.png'))
  await composeOnCanvas(emblem, 32, 32, 0.8, path.join(ROOT, 'public/icons/favicon-32.png'))
  await writePngAsIco(path.join(ROOT, 'public/icons/favicon-32.png'), path.join(ROOT, 'public/favicon.ico'))

  // --- Apple startup images: full logo (emblem + wordmark), matching the
  // in-app launch screen composition. ---
  for (const device of APPLE_SPLASH_DEVICES) {
    await composeSplash(fullLogo, device.width * device.scale, device.height * device.scale, path.join(ROOT, `public/splash/${device.id}-portrait.png`))
    await composeSplash(fullLogo, device.height * device.scale, device.width * device.scale, path.join(ROOT, `public/splash/${device.id}-landscape.png`))
  }

  // --- Brand master + trimmed full-logo (login page, first launch). ---
  await copyFile(sourcePath, path.join(ROOT, 'public/brand/arawan-logo-original.png'))
  await fullLogo.clone().png().toFile(path.join(ROOT, 'public/brand/arawan-logo.png'))

  console.log('Done. Generated icons/, splash/, brand/, favicon.ico.')
  console.log('Read the outputs back at true size before trusting them -- see docs/workbook-analysis.md sibling note in README.')
}

function samplePixel(data, width, channels, x, y) {
  const i = (y * width + x) * channels
  return [data[i], data[i + 1], data[i + 2]]
}
function pixelDistance(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
}
function findBands(height, rowHasInk) {
  const bands = []
  let start = -1
  let gap = 0
  for (let y = 0; y < height; y++) {
    if (rowHasInk(y)) {
      if (start === -1) start = y
      gap = 0
    } else if (start !== -1) {
      gap++
      if (gap > 8) {
        bands.push({ start, end: y - gap })
        start = -1
        gap = 0
      }
    }
  }
  if (start !== -1) bands.push({ start, end: height - 1 })
  return bands
}
function tightBBox(data, width, channels, bg, yStart, yEnd) {
  let xMin = width, xMax = 0, yMin = yEnd, yMax = yStart
  for (let y = yStart; y <= yEnd; y++) {
    for (let x = 0; x < width; x++) {
      if (pixelDistance(samplePixel(data, width, channels, x, y), bg) > INK_THRESHOLD) {
        if (x < xMin) xMin = x
        if (x > xMax) xMax = x
        if (y < yMin) yMin = y
        if (y > yMax) yMax = y
      }
    }
  }
  const pad = Math.round((xMax - xMin) * 0.04)
  return {
    left: Math.max(0, xMin - pad),
    top: Math.max(0, yMin - pad),
    right: Math.min(width, xMax + pad),
    bottom: Math.min(width, yMax + pad),
  }
}
function boxToRegion(box) {
  return { left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top }
}

async function composeOnCanvas(image, canvasW, canvasH, contentFraction, outPath) {
  const targetSize = Math.round(Math.min(canvasW, canvasH) * contentFraction)
  const resized = await image.clone().resize({ width: targetSize, height: targetSize, fit: 'inside' }).png().toBuffer()
  const meta = await sharp(resized).metadata()
  await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { ...CANVAS, alpha: 1 } },
  })
    .composite([{ input: resized, left: Math.round((canvasW - meta.width) / 2), top: Math.round((canvasH - meta.height) / 2) }])
    .png()
    .toFile(outPath)
}

async function composeSplash(fullLogoImage, canvasW, canvasH, outPath) {
  const targetHeight = Math.round(Math.min(canvasW, canvasH) * 0.3)
  const resized = await fullLogoImage.clone().resize({ height: targetHeight, fit: 'inside' }).png().toBuffer()
  const meta = await sharp(resized).metadata()
  await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { ...CANVAS, alpha: 1 } },
  })
    .composite([{ input: resized, left: Math.round((canvasW - meta.width) / 2), top: Math.round((canvasH - meta.height) / 2) }])
    .png()
    .toFile(outPath)
}

/** Wraps a PNG buffer in a minimal single-image ICO container (browsers/Windows accept PNG-in-ICO since Vista). */
async function writePngAsIco(pngPath, icoPath) {
  const { readFile, writeFile } = await import('node:fs/promises')
  const png = await readFile(pngPath)
  const meta = await sharp(png).metadata()
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // image count
  const entry = Buffer.alloc(16)
  entry.writeUInt8(meta.width >= 256 ? 0 : meta.width, 0)
  entry.writeUInt8(meta.height >= 256 ? 0 : meta.height, 1)
  entry.writeUInt8(0, 2) // color palette
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // color planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(png.length, 8) // image data size
  entry.writeUInt32LE(header.length + entry.length, 12) // offset
  await writeFile(icoPath, Buffer.concat([header, entry, png]))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
