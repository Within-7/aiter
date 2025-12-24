/**
 * ICNS file parser
 *
 * Parses macOS .icns icon files and extracts the largest PNG image.
 * ICNS format: https://en.wikipedia.org/wiki/Apple_Icon_Image_format
 *
 * Structure:
 * - Magic number: 'icns' (4 bytes)
 * - File size (4 bytes, big-endian)
 * - Icon entries: each has type (4 bytes) + size (4 bytes) + data
 */

// ICNS icon types that contain PNG data (newer format)
// These types store raw PNG data directly
const PNG_ICON_TYPES: Record<string, { size: number; description: string }> = {
  'ic07': { size: 128, description: '128x128 PNG' },
  'ic08': { size: 256, description: '256x256 PNG' },
  'ic09': { size: 512, description: '512x512 PNG' },
  'ic10': { size: 1024, description: '1024x1024 PNG (512x512@2x)' },
  'ic11': { size: 32, description: '32x32 PNG (16x16@2x)' },
  'ic12': { size: 64, description: '64x64 PNG (32x32@2x)' },
  'ic13': { size: 256, description: '256x256 PNG (128x128@2x)' },
  'ic14': { size: 512, description: '512x512 PNG (256x256@2x)' },
}

// Legacy ICNS types that contain JPEG2000 data
const JP2_ICON_TYPES: Record<string, { size: number; description: string }> = {
  'ic07': { size: 128, description: '128x128 JPEG2000' },
  'ic08': { size: 256, description: '256x256 JPEG2000' },
  'ic09': { size: 512, description: '512x512 JPEG2000' },
  'ic10': { size: 1024, description: '1024x1024 JPEG2000' },
}

// PNG magic bytes
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

interface IconEntry {
  type: string
  size: number
  data: Buffer
  isPNG: boolean
}

/**
 * Parse an ICNS file and extract all icon entries
 */
function parseICNS(buffer: Buffer): IconEntry[] {
  const entries: IconEntry[] = []

  // Check magic number
  const magic = buffer.slice(0, 4).toString('ascii')
  if (magic !== 'icns') {
    throw new Error('Invalid ICNS file: wrong magic number')
  }

  // Get file size from header
  const fileSize = buffer.readUInt32BE(4)
  if (fileSize !== buffer.length) {
    console.warn(`ICNS file size mismatch: header says ${fileSize}, actual is ${buffer.length}`)
  }

  // Parse icon entries
  let offset = 8 // Skip magic + file size

  while (offset < buffer.length - 8) {
    const entryType = buffer.slice(offset, offset + 4).toString('ascii')
    const entrySize = buffer.readUInt32BE(offset + 4)

    if (entrySize < 8) {
      console.warn(`Invalid ICNS entry size: ${entrySize} at offset ${offset}`)
      break
    }

    // Entry data starts after type (4 bytes) and size (4 bytes)
    const dataOffset = offset + 8
    const dataSize = entrySize - 8

    if (dataOffset + dataSize > buffer.length) {
      console.warn(`ICNS entry extends beyond file: ${dataOffset + dataSize} > ${buffer.length}`)
      break
    }

    const data = buffer.slice(dataOffset, dataOffset + dataSize)

    // Check if data is PNG by looking for PNG signature
    const isPNG = data.length >= 8 && data.slice(0, 8).equals(PNG_SIGNATURE)

    entries.push({
      type: entryType,
      size: dataSize,
      data,
      isPNG
    })

    offset += entrySize
  }

  return entries
}

/**
 * Get the estimated pixel size for an icon type
 */
function getIconSize(type: string): number {
  if (PNG_ICON_TYPES[type]) {
    return PNG_ICON_TYPES[type].size
  }
  if (JP2_ICON_TYPES[type]) {
    return JP2_ICON_TYPES[type].size
  }

  // Legacy icon types (raw bitmap data, not directly usable)
  const legacySizes: Record<string, number> = {
    'ICON': 32,   // 32x32 1-bit
    'ICN#': 32,   // 32x32 1-bit with mask
    'icm#': 16,   // 16x12 1-bit with mask
    'icm4': 16,   // 16x12 4-bit
    'icm8': 16,   // 16x12 8-bit
    'ics#': 16,   // 16x16 1-bit with mask
    'ics4': 16,   // 16x16 4-bit
    'ics8': 16,   // 16x16 8-bit
    'is32': 16,   // 16x16 24-bit
    's8mk': 16,   // 16x16 8-bit mask
    'icl4': 32,   // 32x32 4-bit
    'icl8': 32,   // 32x32 8-bit
    'il32': 32,   // 32x32 24-bit
    'l8mk': 32,   // 32x32 8-bit mask
    'ich#': 48,   // 48x48 1-bit with mask
    'ich4': 48,   // 48x48 4-bit
    'ich8': 48,   // 48x48 8-bit
    'ih32': 48,   // 48x48 24-bit
    'h8mk': 48,   // 48x48 8-bit mask
    'it32': 128,  // 128x128 24-bit
    't8mk': 128,  // 128x128 8-bit mask
    'icp4': 16,   // 16x16 PNG
    'icp5': 32,   // 32x32 PNG
    'icp6': 64,   // 64x64 PNG
  }

  return legacySizes[type] || 0
}

/**
 * Extract the largest PNG image from an ICNS file
 * Returns base64-encoded PNG data URI or null if no PNG found
 */
export function extractLargestPNG(buffer: Buffer): string | null {
  try {
    const entries = parseICNS(buffer)

    // Filter to only PNG entries and sort by size (largest first)
    const pngEntries = entries
      .filter(entry => entry.isPNG)
      .sort((a, b) => getIconSize(b.type) - getIconSize(a.type))

    if (pngEntries.length === 0) {
      console.warn('No PNG images found in ICNS file')
      return null
    }

    // Return the largest PNG
    const largest = pngEntries[0]
    return `data:image/png;base64,${largest.data.toString('base64')}`
  } catch (error) {
    console.error('Error parsing ICNS file:', error)
    return null
  }
}

/**
 * Check if a buffer is a valid ICNS file
 */
export function isValidICNS(buffer: Buffer): boolean {
  if (buffer.length < 8) return false
  return buffer.slice(0, 4).toString('ascii') === 'icns'
}

/**
 * Get info about all icons in an ICNS file
 */
export function getICNSInfo(buffer: Buffer): { type: string; size: number; isPNG: boolean; pixelSize: number }[] {
  try {
    const entries = parseICNS(buffer)
    return entries.map(entry => ({
      type: entry.type,
      size: entry.size,
      isPNG: entry.isPNG,
      pixelSize: getIconSize(entry.type)
    }))
  } catch {
    return []
  }
}
