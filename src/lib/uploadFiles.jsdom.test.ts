import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { expandFiles } from './uploadFiles'

function readWithFileReader(blob: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read blob.'))
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.readAsArrayBuffer(blob)
  })
}

describe('expandFiles (jsdom)', () => {
  it('expands zip archives using FileReader fallback', async () => {
    const zip = zipSync({
      'hetzner-cloud-skill/SKILL.md': new Uint8Array(strToU8('hello')),
      'hetzner-cloud-skill/notes.txt': new Uint8Array(strToU8('notes')),
    })
    const zipBytes = Uint8Array.from(zip).buffer
    const zipFile = new File([zipBytes], 'bundle.zip', { type: 'application/zip' })

    const readerBuffer = await readWithFileReader(zipFile)
    const entries = unzipSync(new Uint8Array(readerBuffer))
    expect(Object.keys(entries)).toEqual(
      expect.arrayContaining(['hetzner-cloud-skill/SKILL.md', 'hetzner-cloud-skill/notes.txt']),
    )

    const expanded = await expandFiles([zipFile])
    expect(expanded.map((file) => file.name)).toEqual(['SKILL.md', 'notes.txt'])
  })
})
