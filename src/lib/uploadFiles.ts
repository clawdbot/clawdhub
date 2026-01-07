import { TEXT_FILE_EXTENSION_SET } from 'clawdhub-schema'
import { gunzipSync, unzipSync } from 'fflate'

const TEXT_TYPES = new Map([
  ['md', 'text/markdown'],
  ['markdown', 'text/markdown'],
  ['txt', 'text/plain'],
  ['json', 'application/json'],
  ['yaml', 'text/yaml'],
  ['yml', 'text/yaml'],
  ['toml', 'text/plain'],
  ['js', 'text/javascript'],
  ['ts', 'text/plain'],
  ['tsx', 'text/plain'],
  ['jsx', 'text/plain'],
  ['css', 'text/css'],
  ['html', 'text/html'],
  ['svg', 'image/svg+xml'],
])

export async function expandFiles(selected: File[]) {
  const expanded: File[] = []
  for (const file of selected) {
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.zip')) {
      const entries = unzipSync(new Uint8Array(await readArrayBuffer(file)))
      pushArchiveEntries(
        expanded,
        Object.entries(entries).map(([path, data]) => ({ path, data })),
      )
      continue
    }
    if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
      const unpacked = gunzipSync(new Uint8Array(await readArrayBuffer(file)))
      pushArchiveEntries(expanded, untar(unpacked))
      continue
    }
    if (lower.endsWith('.gz')) {
      const unpacked = gunzipSync(new Uint8Array(await readArrayBuffer(file)))
      const name = file.name.replace(/\.gz$/i, '')
      expanded.push(new File([toArrayBuffer(unpacked)], name, { type: guessContentType(name) }))
      continue
    }
    expanded.push(file)
  }
  return expanded
}

function pushArchiveEntries(target: File[], entries: Array<{ path: string; data: Uint8Array }>) {
  const normalized = entries
    .map((entry) => ({ ...entry, path: normalizePath(entry.path) }))
    .filter((entry) => entry.path && !entry.path.endsWith('/'))
    .filter((entry) => !isJunkPath(entry.path))
    .filter((entry) => isTextPath(entry.path))

  const unwrapped = unwrapSingleTopLevelFolder(normalized)

  for (const entry of unwrapped) {
    target.push(
      new File([toArrayBuffer(entry.data)], entry.path, {
        type: guessContentType(entry.path),
      }),
    )
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = bytes.buffer
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
  return Uint8Array.from(bytes).buffer
}

async function readArrayBuffer(file: Blob) {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer()
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'))
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.readAsArrayBuffer(file)
    })
  }
  return new Response(file as BodyInit).arrayBuffer()
}

function guessContentType(path: string) {
  const ext = path.split('.').pop()?.toLowerCase()
  if (!ext) return 'application/octet-stream'
  const known = TEXT_TYPES.get(ext)
  if (known) return known
  if (TEXT_FILE_EXTENSION_SET.has(ext)) return 'text/plain'
  return 'application/octet-stream'
}

function normalizePath(path: string) {
  return path
    .replaceAll('\u0000', '')
    .replaceAll('\\', '/')
    .trim()
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
}

function untar(bytes: Uint8Array) {
  const entries: Array<{ path: string; data: Uint8Array }> = []
  let offset = 0
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const name = readString(header.subarray(0, 100))
    const size = readOctal(header.subarray(124, 136))
    const typeflag = header[156]
    offset += 512
    const data = bytes.subarray(offset, offset + size)
    offset += Math.ceil(size / 512) * 512
    if (!name || typeflag === 53) continue
    entries.push({ path: name, data })
  }
  return entries
}

function readString(bytes: Uint8Array) {
  const end = bytes.indexOf(0)
  const slice = end === -1 ? bytes : bytes.subarray(0, end)
  return new TextDecoder().decode(slice).trim()
}

function readOctal(bytes: Uint8Array) {
  const raw = readString(bytes)
  return raw ? Number.parseInt(raw, 8) : 0
}

function unwrapSingleTopLevelFolder<T extends { path: string }>(entries: T[]) {
  if (entries.length === 0) return entries

  const segments = entries.map((entry) => entry.path.split('/').filter(Boolean))
  if (segments.some((parts) => parts.length < 2)) return entries

  const first = segments[0]?.[0]
  if (!first) return entries
  if (!segments.every((parts) => parts[0] === first)) return entries

  return entries.map((entry) => ({
    ...entry,
    path: entry.path.split('/').slice(1).join('/'),
  }))
}

function isJunkPath(path: string) {
  const normalized = path.toLowerCase()
  if (normalized.startsWith('__macosx/')) return true
  if (normalized.endsWith('/.ds_store')) return true
  if (normalized === '.ds_store') return true
  return false
}

function isTextPath(path: string) {
  const normalized = path.trim().toLowerCase()
  const parts = normalized.split('.')
  const extension = parts.length > 1 ? (parts.at(-1) ?? '') : ''
  if (!extension) return false
  return TEXT_FILE_EXTENSION_SET.has(extension)
}
