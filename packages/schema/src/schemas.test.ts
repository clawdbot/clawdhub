/* @vitest-environment node */

import { describe, expect, it } from 'vitest'
import { parseArk } from './ark'
import { CliPublishRequestSchema, LockfileSchema } from './schemas'

describe('@clawdhub/schema', () => {
  it('parses lockfile records', () => {
    const lock = parseArk(
      LockfileSchema,
      { version: 1, skills: { demo: { version: '1.0.0', installedAt: 123 } } },
      'Lockfile',
    )
    expect(lock.skills.demo?.version).toBe('1.0.0')
  })

  it('allows publish payload without tags', () => {
    const payload = parseArk(
      CliPublishRequestSchema,
      {
        slug: 'demo',
        displayName: 'Demo',
        version: '1.0.0',
        changelog: '',
        files: [{ path: 'SKILL.md', size: 1, storageId: 's', sha256: 'x' }],
      },
      'Publish payload',
    )
    expect(payload.tags).toBeUndefined()
    expect(payload.files[0]?.path).toBe('SKILL.md')
  })

  it('throws labeled errors', () => {
    expect(() => parseArk(LockfileSchema, null, 'Lockfile')).toThrow(/Lockfile:/)
  })
})
