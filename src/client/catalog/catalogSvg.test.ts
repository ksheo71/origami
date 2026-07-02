import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATALOG } from './catalog.js'

// Same coordinate-parsing approach as the one-time crop script (line/rect/polyline/polygon
// elements), extended with a small absolute-command <path> parser (M/L/H/V) to cover
// path-only assets like mapfold.svg. This guards against a future catalog asset being
// added with its crease pattern crammed into a small corner of a huge canvas (the exact
// bug this branch fixed) — content must fill most of the declared viewBox.
function parseBBox(svg: string): { minX: number; maxX: number; minY: number; maxY: number; count: number } | null {
  const xs: number[] = []
  const ys: number[] = []

  for (const m of svg.matchAll(
    /<line\b[^>]*\bx1="([-\d.]+)"[^>]*\by1="([-\d.]+)"[^>]*\bx2="([-\d.]+)"[^>]*\by2="([-\d.]+)"/g,
  )) {
    xs.push(+m[1]!, +m[3]!)
    ys.push(+m[2]!, +m[4]!)
  }
  for (const m of svg.matchAll(
    /<rect\b[^>]*\bx="([-\d.]+)"[^>]*\by="([-\d.]+)"[^>]*\bwidth="([-\d.]+)"[^>]*\bheight="([-\d.]+)"/g,
  )) {
    const x = +m[1]!
    const y = +m[2]!
    const w = +m[3]!
    const h = +m[4]!
    xs.push(x, x + w)
    ys.push(y, y + h)
  }
  for (const m of svg.matchAll(/<poly(?:line|gon)\b[^>]*\bpoints="([^"]+)"/g)) {
    const nums = m[1]!.trim().split(/[\s,]+/).map(Number)
    for (let i = 0; i + 1 < nums.length; i += 2) {
      xs.push(nums[i]!)
      ys.push(nums[i + 1]!)
    }
  }
  // Path fallback: only handles absolute M/L/H/V commands (sufficient for the
  // straight-line crease patterns in this catalog; curves are not present).
  for (const m of svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)) {
    let x = 0
    let y = 0
    for (const cmd of m[1]!.matchAll(/([MLHV])\s*([-\d.,\s]+)/g)) {
      const letter = cmd[1]!
      const nums = cmd[2]!.trim().split(/[\s,]+/).filter(Boolean).map(Number)
      if (letter === 'M' || letter === 'L') {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          x = nums[i]!
          y = nums[i + 1]!
          xs.push(x)
          ys.push(y)
        }
      } else if (letter === 'H') {
        for (const n of nums) {
          x = n
          xs.push(x)
          ys.push(y)
        }
      } else if (letter === 'V') {
        for (const n of nums) {
          y = n
          xs.push(x)
          ys.push(y)
        }
      }
    }
  }

  if (!xs.length) return null

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    count: xs.length,
  }
}

function parseViewBox(svg: string): { minX: number; minY: number; width: number; height: number } | null {
  const m = svg.match(/viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"/)
  if (!m) return null
  return { minX: +m[1]!, minY: +m[2]!, width: +m[3]!, height: +m[4]! }
}

describe('catalog SVG content bounds', () => {
  for (const model of CATALOG) {
    it(`${model.id}: crease pattern fills most of the viewBox`, () => {
      const abs = join(process.cwd(), 'src/client/public', model.svgPath)
      const svg = readFileSync(abs, 'utf8')

      const bbox = parseBBox(svg)
      expect(bbox, `expected at least one parseable coordinate in ${model.svgPath}`).not.toBeNull()
      expect(bbox!.count).toBeGreaterThan(0)

      const viewBox = parseViewBox(svg)
      expect(viewBox, `expected a viewBox attribute in ${model.svgPath}`).not.toBeNull()

      const contentWidth = bbox!.maxX - bbox!.minX
      const contentHeight = bbox!.maxY - bbox!.minY

      const widthRatio = contentWidth / viewBox!.width
      const heightRatio = contentHeight / viewBox!.height

      expect(
        widthRatio,
        `${model.svgPath}: content width ratio ${widthRatio.toFixed(3)} too small — crease pattern looks cropped into a corner of the viewBox`,
      ).toBeGreaterThan(0.6)
      expect(
        heightRatio,
        `${model.svgPath}: content height ratio ${heightRatio.toFixed(3)} too small — crease pattern looks cropped into a corner of the viewBox`,
      ).toBeGreaterThan(0.6)
    })
  }
})
