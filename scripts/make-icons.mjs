import sharp from 'sharp'

// Crop the house graphic from the full logo (landscape) and render square
// PWA icons on a white background.
const SRC = 'public/logo.png'
const HOUSE = { left: 220, top: 20, width: 1560, height: 730 }

async function makeIcon(size, file, scale = 0.86) {
  const inner = Math.round(size * scale)
  const content = await sharp(SRC)
    .extract(HOUSE)
    .resize(inner, inner, { fit: 'inside' })
    .png()
    .toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
    .composite([{ input: content, gravity: 'center' }])
    .png()
    .toFile(file)
  console.log('created', file)
}

await makeIcon(512, 'public/icons/icon-512.png')
await makeIcon(192, 'public/icons/icon-192.png')
await makeIcon(180, 'public/icons/apple-touch-icon.png')
await makeIcon(512, 'public/icons/icon-512-maskable.png', 0.68)
console.log('done')
