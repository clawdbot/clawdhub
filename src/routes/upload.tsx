import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import semver from 'semver'
import { api } from '../../convex/_generated/api'
import { expandFiles } from '../lib/uploadFiles'
import {
  formatBytes,
  formatPublishError,
  hashFile,
  isTextFile,
  readText,
  uploadFile,
} from './upload/utils'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const Route = createFileRoute('/upload')({
  validateSearch: (search) => ({
    updateSlug: typeof search.updateSlug === 'string' ? search.updateSlug : undefined,
  }),
  component: Upload,
})

export function Upload() {
  const { isAuthenticated } = useConvexAuth()
  const { updateSlug } = useSearch({ from: '/upload' })
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl)
  const publishVersion = useAction(api.skills.publishVersion)
  const generateChangelogPreview = useAction(api.skills.generateChangelogPreview)
  const existingSkill = useQuery(
    api.skills.getBySlug,
    updateSlug ? { slug: updateSlug } : 'skip',
  )
  const [hasAttempted, setHasAttempted] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [slug, setSlug] = useState(updateSlug ?? '')
  const [displayName, setDisplayName] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [tags, setTags] = useState('latest')
  const [changelog, setChangelog] = useState('')
  const [changelogStatus, setChangelogStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )
  const [changelogSource, setChangelogSource] = useState<'auto' | 'user' | null>(null)
  const changelogTouchedRef = useRef(false)
  const changelogRequestRef = useRef(0)
  const changelogKeyRef = useRef<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const validationRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const maxBytes = 50 * 1024 * 1024
  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files])
  const stripRoot = useMemo(() => {
    if (files.length === 0) return null
    const paths = files.map((file) => (file.webkitRelativePath || file.name).replace(/^\.\//, ''))
    if (!paths.every((path) => path.includes('/'))) return null
    const firstSegment = paths[0]?.split('/')[0]
    if (!firstSegment) return null
    if (!paths.every((path) => path.startsWith(`${firstSegment}/`))) return null
    return firstSegment
  }, [files])
  const normalizedPaths = useMemo(
    () =>
      files.map((file) => {
        const raw = (file.webkitRelativePath || file.name).replace(/^\.\//, '')
        if (stripRoot && raw.startsWith(`${stripRoot}/`)) {
          return raw.slice(stripRoot.length + 1)
        }
        return raw
      }),
    [files, stripRoot],
  )
  const hasSkillFile = useMemo(
    () =>
      normalizedPaths.some((path) => {
        const lower = path.trim().toLowerCase()
        return lower === 'skill.md' || lower === 'skills.md'
      }),
    [normalizedPaths],
  )
  const sizeLabel = totalBytes ? formatBytes(totalBytes) : '0 B'
  const trimmedSlug = slug.trim()
  const trimmedName = displayName.trim()
  const trimmedChangelog = changelog.trim()

  useEffect(() => {
    if (!existingSkill?.skill || !existingSkill?.latestVersion) return
    setSlug(existingSkill.skill.slug)
    setDisplayName(existingSkill.skill.displayName)
    const nextVersion = semver.inc(existingSkill.latestVersion.version, 'patch')
    if (nextVersion) setVersion(nextVersion)
  }, [existingSkill])

  useEffect(() => {
    if (changelogTouchedRef.current) return
    if (trimmedChangelog) return
    if (!trimmedSlug || !SLUG_PATTERN.test(trimmedSlug)) return
    if (!semver.valid(version)) return
    if (!hasSkillFile) return
    if (files.length === 0) return

    const skillIndex = normalizedPaths.findIndex((path) => {
      const lower = path.trim().toLowerCase()
      return lower === 'skill.md' || lower === 'skills.md'
    })
    if (skillIndex < 0) return

    const skillFile = files[skillIndex]
    if (!skillFile) return

    const key = `${trimmedSlug}:${version}:${skillFile.size}:${skillFile.lastModified}:${normalizedPaths.length}`
    if (changelogKeyRef.current === key) return
    changelogKeyRef.current = key

    const requestId = ++changelogRequestRef.current
    setChangelogStatus('loading')

    void readText(skillFile)
      .then((text) => {
        if (changelogRequestRef.current !== requestId) return null
        return generateChangelogPreview({
          slug: trimmedSlug,
          version,
          readmeText: text.slice(0, 20_000),
          filePaths: normalizedPaths,
        })
      })
      .then((result) => {
        if (!result) return
        if (changelogRequestRef.current !== requestId) return
        setChangelog(result.changelog)
        setChangelogSource('auto')
        setChangelogStatus('ready')
      })
      .catch(() => {
        if (changelogRequestRef.current !== requestId) return
        setChangelogStatus('error')
      })
  }, [
    files,
    generateChangelogPreview,
    hasSkillFile,
    normalizedPaths,
    trimmedChangelog,
    trimmedSlug,
    version,
  ])
  const parsedTags = useMemo(
    () =>
      tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tags],
  )
  const validation = useMemo(() => {
    const issues: string[] = []
    if (!trimmedSlug) {
      issues.push('Slug is required.')
    } else if (!SLUG_PATTERN.test(trimmedSlug)) {
      issues.push('Slug must be lowercase and use dashes only.')
    }
    if (!trimmedName) {
      issues.push('Display name is required.')
    }
    if (!semver.valid(version)) {
      issues.push('Version must be valid semver (e.g. 1.0.0).')
    }
    if (parsedTags.length === 0) {
      issues.push('At least one tag is required.')
    }
    if (files.length === 0) {
      issues.push('Add at least one file.')
    }
    if (!hasSkillFile) {
      issues.push('SKILL.md is required.')
    }
    const invalidFiles = files.filter((file) => !isTextFile(file))
    if (invalidFiles.length > 0) {
      issues.push(
        `Remove non-text files: ${invalidFiles
          .slice(0, 3)
          .map((file) => file.name)
          .join(', ')}`,
      )
    }
    if (totalBytes > maxBytes) {
      issues.push('Total file size exceeds 50MB.')
    }
    return {
      issues,
      ready: issues.length === 0,
    }
  }, [trimmedSlug, trimmedName, version, parsedTags.length, files, hasSkillFile, totalBytes])

  useEffect(() => {
    if (!fileInputRef.current) return
    fileInputRef.current.setAttribute('webkitdirectory', '')
    fileInputRef.current.setAttribute('directory', '')
  }, [])

  if (!isAuthenticated) {
    return (
      <main className="section">
        <div className="card">Sign in to upload a skill.</div>
      </main>
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setHasAttempted(true)
    if (!validation.ready) {
      if (validationRef.current && 'scrollIntoView' in validationRef.current) {
        validationRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }
    setError(null)
    if (totalBytes > maxBytes) {
      setError('Total size exceeds 50MB per version.')
      return
    }
    if (!hasSkillFile) {
      setError('SKILL.md is required.')
      return
    }
    setStatus('Uploading files…')

    const uploaded = [] as Array<{
      path: string
      size: number
      storageId: string
      sha256: string
      contentType?: string
    }>

    for (const file of files) {
      const uploadUrl = await generateUploadUrl()
      const storageId = await uploadFile(uploadUrl, file)
      const sha256 = await hashFile(file)
      const rawPath = (file.webkitRelativePath || file.name).replace(/^\.\//, '')
      const path =
        stripRoot && rawPath.startsWith(`${stripRoot}/`)
          ? rawPath.slice(stripRoot.length + 1)
          : rawPath
      uploaded.push({
        path,
        size: file.size,
        storageId,
        sha256,
        contentType: file.type || undefined,
      })
    }

    setStatus('Publishing version…')
    try {
      await publishVersion({
        slug: trimmedSlug,
        displayName: trimmedName,
        version,
        changelog: trimmedChangelog,
        tags: parsedTags,
        files: uploaded,
      })
      setStatus('Published.')
      void navigate({ to: '/skills/$slug', params: { slug: trimmedSlug } })
    } catch (publishError) {
      const message = formatPublishError(publishError)
      setError(message)
      setStatus(null)
      if (validationRef.current && 'scrollIntoView' in validationRef.current) {
        validationRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  async function handleFilesSelected(selected: File[]) {
    if (selected.length === 0) return
    setError(null)
    setStatus('Preparing files…')
    let expanded: File[] = []
    try {
      expanded = await expandFiles(selected)
      setStatus(null)
    } catch (expandError) {
      const message =
        expandError instanceof Error ? expandError.message : 'Could not extract files.'
      setError(message)
      setStatus(null)
      return
    }
    const next = new Map<string, File>()
    for (const file of files) {
      const key = `${file.webkitRelativePath || file.name}:${file.size}`
      next.set(key, file)
    }
    for (const file of expanded) {
      const key = `${file.webkitRelativePath || file.name}:${file.size}`
      next.set(key, file)
    }
    setFiles(Array.from(next.values()))
  }

  function handleRemoveFile(target: File) {
    setFiles((current) =>
      current.filter(
        (file) =>
          `${file.webkitRelativePath || file.name}:${file.size}` !==
          `${target.webkitRelativePath || target.name}:${target.size}`,
      ),
    )
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDragging(false)
    void handleFilesSelected(Array.from(event.dataTransfer.files ?? []))
  }

  function handleDragOver(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  return (
    <main className="section upload-shell">
      <header className="upload-header">
        <div>
          <span className="upload-kicker">Publish</span>
          <h1 className="upload-title">Publish a skill</h1>
          <p className="upload-subtitle">
            Bundle SKILL.md + text files. Tag it, version it, ship it.
          </p>
        </div>
      </header>
      <form className="upload-card" onSubmit={handleSubmit}>
        <div className="upload-grid">
          <div className="upload-fields">
            <label className="upload-field">
              <span>Slug</span>
              <input
                className="search-input upload-input"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="my-skill-pack"
              />
            </label>
            <label className="upload-field">
              <span>Display name</span>
              <input
                className="search-input upload-input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="My Skill Pack"
              />
            </label>
            <div className="upload-row">
              <label className="upload-field">
                <span>Version</span>
                <input
                  className="search-input upload-input"
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                  placeholder="1.0.0"
                />
              </label>
              <label className="upload-field">
                <span>Tags</span>
                <input
                  className="search-input upload-input"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="latest, beta"
                />
              </label>
            </div>
            <label className="upload-field">
              <div className="upload-field-header">
                <span>Changelog</span>
                {changelogSource === 'auto' ? (
                  <span className="upload-field-hint">
                    {changelogStatus === 'loading' ? 'Auto-generating…' : 'Auto-generated'}
                  </span>
                ) : changelogStatus === 'error' ? (
                  <span className="upload-field-hint">Auto-generation failed</span>
                ) : changelogStatus === 'loading' ? (
                  <span className="upload-field-hint">Auto-generating…</span>
                ) : null}
              </div>
              <textarea
                className="search-input upload-input"
                rows={4}
                value={changelog}
                onChange={(event) => {
                  changelogTouchedRef.current = true
                  changelogRequestRef.current += 1
                  setChangelogSource('user')
                  setChangelogStatus('idle')
                  setChangelog(event.target.value)
                }}
                placeholder="What changed in this version?"
              />
            </label>
          </div>
          <div className="upload-side">
            <div className={`dropzone${isDragging ? ' is-dragging' : ''}`}>
              <button
                className="dropzone-button"
                type="button"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon">⬇</div>
                <div>
                  <strong>Drop a folder, files, or zip</strong>
                  <p>Click to choose a folder. Archives auto-extract.</p>
                </div>
              </button>
              <input
                ref={fileInputRef}
                className="dropzone-input"
                type="file"
                multiple
                data-testid="upload-input"
                onChange={(event) => void handleFilesSelected(Array.from(event.target.files ?? []))}
              />
            </div>
            <div className="upload-summary">
              <div>
                <strong>{files.length}</strong> files · <span>{sizeLabel}</span>
              </div>
              <div className={`upload-requirement${hasSkillFile ? ' ok' : ''}`}>
                SKILL.md {hasSkillFile ? 'found' : 'required'}
              </div>
              {files.length ? (
                <div className="upload-filelist">
                  {files.map((file, index) => (
                    <div
                      key={`${file.webkitRelativePath || file.name}:${file.size}`}
                      className="upload-file"
                    >
                      <span>
                        {normalizedPaths[index] ?? (file.webkitRelativePath || file.name)}
                      </span>
                      <span>{formatBytes(file.size)}</span>
                      <button
                        className="upload-remove"
                        type="button"
                        onClick={() => handleRemoveFile(file)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="upload-muted">No files selected yet.</p>
              )}
              {files.length ? (
                <button className="btn" type="button" onClick={() => setFiles([])}>
                  Clear selection
                </button>
              ) : null}
            </div>
            <div className="upload-notes">
              <strong>Checks</strong>
              <ul>
                <li>Include SKILL.md</li>
                <li>50 MB max per version</li>
                <li>Changelog optional</li>
                <li>Valid semver version</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="upload-footer" ref={validationRef}>
          <button className="btn btn-primary" type="submit" disabled={Boolean(status)}>
            Publish
          </button>
          {hasAttempted && !validation.ready ? (
            <div className="upload-validation">
              {validation.issues.map((issue) => (
                <div key={issue} className="upload-validation-item">
                  {issue}
                </div>
              ))}
            </div>
          ) : error ? null : validation.ready ? (
            <div className="upload-ready">Ready to publish.</div>
          ) : null}
          {error ? <div className="stat upload-error">{error}</div> : null}
          {status ? <div className="stat">{status}</div> : null}
        </div>
      </form>
    </main>
  )
}
