/**
 * Resolves REAL photographs for the catalogue from Wikimedia Commons.
 *
 *   node scripts/fetch-place-media.mjs
 *
 * Why an API query and not a hardcoded URL list: guessing Commons filenames
 * produces 404s, and a 404 in production is a broken image — worse than the
 * procedural artwork it was meant to replace. This asks Commons what files
 * actually exist for each place, takes the first real photograph, verifies the
 * URL responds, and records the licence and author so the app can attribute it.
 *
 * Output: src/data/placeMedia.generated.json  (committed)
 *
 * Nothing is invented. A place with no usable result is simply left out, and
 * `media.ts` falls back to the designed artwork for it.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const API = 'https://commons.wikimedia.org/w/api.php'
const WIDTH = 1400

/**
 * Search terms per catalogue slug.
 *
 * Deliberately explicit rather than derived from the place name: "Dar El Jeld"
 * alone returns unrelated files, while "Dar El Jeld Tunis restaurant" does not.
 * Slugs must match src/data/places.ts.
 */
const TERMS = {
  carthage: 'Carthage Tunisia Roman ruins',
  'sidi-bou-said': 'Sidi Bou Said Tunisia',
  'medina-of-tunis': 'Medina of Tunis',
  'bardo-museum': 'Bardo National Museum Tunis mosaic',
  'el-jem-amphitheatre': 'Amphitheatre of El Jem',
  dougga: 'Dougga Capitol Tunisia',
  'kairouan-great-mosque': 'Great Mosque of Kairouan courtyard',
  'hammamet-beach': 'Hammamet Tunisia beach',
  'sidi-mahrez-beach': 'Djerba Tunisia beach',
  'tabarka-coast': 'Tabarka Tunisia Aiguilles',
  'cap-angela': 'Cap Angela Tunisia',
  'ichkeul-park': 'Ichkeul National Park Tunisia',
  'chebika-oasis': 'Chebika Tunisia oasis',
  'ksar-ghilane': 'Ksar Ghilane Tunisia desert',
  matmata: 'Matmata Tunisia troglodyte',
  'sousse-medina': 'Ribat of Sousse Tunisia',
  'la-goulette-grills': 'La Goulette Tunisia port',
  'gammarth-bay': 'Gammarth Tunisia',
  'port-el-kantaoui': 'Port El Kantaoui marina',
  'yasmine-marina': 'Yasmine Hammamet marina',
  'dar-el-jeld': 'Tunis medina traditional house courtyard',
  'sidi-bou-terraces': 'Sidi Bou Said cafe terrace sea',
  'la-badira': 'Hammamet Tunisia hotel bay',
  'villa-didon': 'Carthage Tunisia hill view',
  'dar-hi': 'Tozeur Tunisia palm grove',
}

const BAD_EXT = /\.(svg|ogv|webm|pdf|tif|tiff|gif)$/i

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Commons rate-limits hard; back off and retry rather than losing the slug. */
async function searchWithRetry(term, attempts = 4) {
  let wait = 2000
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await search(term)
    } catch (error) {
      if (attempt === attempts || !/429/.test(error.message)) throw error
      await new Promise((done) => setTimeout(done, wait))
      wait *= 2
    }
  }
  return null
}

async function search(term) {
  const url =
    `${API}?action=query&format=json&origin=*` +
    `&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(term)}` +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=${WIDTH}`

  const response = await fetch(url, {
    headers: { 'User-Agent': 'TuniTravel/1.0 (catalogue media resolver)' },
  })
  if (!response.ok) throw new Error(`Commons API ${response.status}`)

  const body = await response.json()
  const pages = Object.values(body?.query?.pages ?? {})

  for (const page of pages) {
    const info = page?.imageinfo?.[0]
    if (!info?.thumburl || BAD_EXT.test(page.title ?? '')) continue
    // Landscape-ish only: portrait crops badly in the 4:3 and 16:10 frames.
    if (info.width && info.height && info.width < info.height) continue

    const meta = info.extmetadata ?? {}
    return {
      src: info.thumburl,
      width: info.thumbwidth ?? null,
      height: info.thumbheight ?? null,
      credit: stripHtml(meta.Artist?.value) || 'Wikimedia Commons',
      license: stripHtml(meta.LicenseShortName?.value) || 'see source',
      source: info.descriptionurl ?? null,
      file: page.title ?? null,
    }
  }
  return null
}

async function verify(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

const OUT_PATH = 'src/data/placeMedia.generated.json'

// Resumable: a run that got rate-limited halfway keeps what it already had.
const out = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, 'utf8')) : {}
let resolved = 0
let skipped = 0
let kept = 0

for (const [slug, term] of Object.entries(TERMS)) {
  if (out[slug]?.src) {
    kept += 1
    continue
  }
  try {
    const hit = await searchWithRetry(term)
    if (!hit) {
      console.log(`skip  ${slug.padEnd(24)} no usable file for "${term}"`)
      skipped += 1
      continue
    }
    if (!(await verify(hit.src))) {
      console.log(`skip  ${slug.padEnd(24)} URL did not respond`)
      skipped += 1
      continue
    }
    out[slug] = hit
    resolved += 1
    console.log(`ok    ${slug.padEnd(24)} ${hit.license.padEnd(14)} ${hit.file}`)
  } catch (error) {
    console.log(`skip  ${slug.padEnd(24)} ${error.message}`)
    skipped += 1
  }
  await new Promise((done) => setTimeout(done, 1200))
}

writeFileSync(
  'src/data/placeMedia.generated.json',
  `${JSON.stringify(out, null, 2)}\n`,
  'utf8',
)

console.log(`\nresolved ${resolved}, skipped ${skipped}`)
console.log('wrote src/data/placeMedia.generated.json')
