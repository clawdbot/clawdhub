import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { strToU8, zipSync } from 'fflate'
import { vi } from 'vitest'

import { Upload } from '../routes/upload'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: { component: unknown }) => config,
  useNavigate: () => vi.fn(),
}))

const generateUploadUrl = vi.fn()
const publishVersion = vi.fn()
const fetchMock = vi.fn()

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useMutation: () => generateUploadUrl,
  useAction: () => publishVersion,
}))

describe('Upload route', () => {
  beforeEach(() => {
    generateUploadUrl.mockReset()
    publishVersion.mockReset()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: 'storage-id' }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hides validation issues until submit', async () => {
    render(<Upload />)
    const publishButton = screen.getByRole('button', { name: /publish/i })
    expect(publishButton).toBeTruthy()
    expect(screen.queryByText(/Slug is required/i)).toBeNull()
    fireEvent.click(publishButton)
    await waitFor(() => {
      expect(screen.getByText(/Slug is required/i)).toBeTruthy()
    })
    expect(screen.getByText(/Display name is required/i)).toBeTruthy()
  })

  it('marks the input for folder uploads', async () => {
    render(<Upload />)
    const input = screen.getByTestId('upload-input')
    await waitFor(() => {
      expect(input.getAttribute('webkitdirectory')).not.toBeNull()
    })
  })

  it('enables publish when fields and files are valid, and allows removing files', async () => {
    generateUploadUrl.mockResolvedValue('https://upload.local')
    render(<Upload />)
    fireEvent.change(screen.getByPlaceholderText('my-skill-pack'), {
      target: { value: 'cool-skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('My Skill Pack'), {
      target: { value: 'Cool Skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('1.0.0'), {
      target: { value: '1.2.3' },
    })
    fireEvent.change(screen.getByPlaceholderText('latest, beta'), {
      target: { value: 'latest' },
    })
    const file = new File(['hello'], 'SKILL.md', { type: 'text/markdown' })
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    const publishButton = screen.getByRole('button', { name: /publish/i }) as HTMLButtonElement
    expect(await screen.findByText(/Ready to publish/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    expect(screen.queryByText(/Add at least one file/i)).toBeNull()
    fireEvent.click(publishButton)
    expect(await screen.findByText(/Add at least one file/i)).toBeTruthy()
  })

  it('extracts zip uploads and unwraps top-level folders', async () => {
    render(<Upload />)
    fireEvent.change(screen.getByPlaceholderText('my-skill-pack'), {
      target: { value: 'cool-skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('My Skill Pack'), {
      target: { value: 'Cool Skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('1.0.0'), {
      target: { value: '1.2.3' },
    })
    fireEvent.change(screen.getByPlaceholderText('latest, beta'), {
      target: { value: 'latest' },
    })

    const zip = zipSync({
      'hetzner-cloud-skill/SKILL.md': new Uint8Array(strToU8('hello')),
      'hetzner-cloud-skill/notes.txt': new Uint8Array(strToU8('notes')),
    })
    const zipBytes = Uint8Array.from(zip).buffer
    const zipFile = new File([zipBytes], 'bundle.zip', { type: 'application/zip' })

    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [zipFile] } })

    expect(await screen.findByText('notes.txt', {}, { timeout: 3000 })).toBeTruthy()
    expect(screen.getByText('SKILL.md')).toBeTruthy()
    expect(await screen.findByText(/Ready to publish/i, {}, { timeout: 3000 })).toBeTruthy()
  })

  it('unwraps folder uploads so SKILL.md can be at the top-level', async () => {
    generateUploadUrl.mockResolvedValue('https://upload.local')
    publishVersion.mockResolvedValue(undefined)
    render(<Upload />)
    fireEvent.change(screen.getByPlaceholderText('my-skill-pack'), {
      target: { value: 'ynab' },
    })
    fireEvent.change(screen.getByPlaceholderText('My Skill Pack'), {
      target: { value: 'YNAB' },
    })
    fireEvent.change(screen.getByPlaceholderText('1.0.0'), {
      target: { value: '1.0.0' },
    })
    fireEvent.change(screen.getByPlaceholderText('latest, beta'), {
      target: { value: 'latest' },
    })

    const file = new File(['hello'], 'SKILL.md', { type: 'text/markdown' })
    Object.defineProperty(file, 'webkitRelativePath', { value: 'ynab/SKILL.md' })

    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText('SKILL.md')).toBeTruthy()
    expect(await screen.findByText(/Ready to publish/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /publish/i }))
    await waitFor(() => {
      expect(
        publishVersion.mock.calls.some((call) =>
          Array.isArray((call[0] as { files?: unknown }).files),
        ),
      ).toBe(true)
    })
    const args = publishVersion.mock.calls
      .map((call) => call[0] as { files?: Array<{ path: string }> })
      .find((call) => Array.isArray(call.files))
    expect(args?.files?.[0]?.path).toBe('SKILL.md')
  })

  it('blocks non-text folder uploads (png)', async () => {
    render(<Upload />)
    fireEvent.change(screen.getByPlaceholderText('my-skill-pack'), {
      target: { value: 'cool-skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('My Skill Pack'), {
      target: { value: 'Cool Skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('1.0.0'), {
      target: { value: '1.2.3' },
    })
    fireEvent.change(screen.getByPlaceholderText('latest, beta'), {
      target: { value: 'latest' },
    })

    const skill = new File(['hello'], 'SKILL.md', { type: 'text/markdown' })
    const png = new File([new Uint8Array([137, 80, 78, 71]).buffer], 'screenshot.png', {
      type: 'image/png',
    })
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [skill, png] } })

    expect(await screen.findByText('screenshot.png')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /publish/i }))
    expect(await screen.findByText(/Remove non-text files: screenshot\.png/i)).toBeTruthy()
    expect(screen.getByText('screenshot.png')).toBeTruthy()
  })

  it('surfaces publish errors and stays on page', async () => {
    publishVersion.mockRejectedValueOnce(new Error('Changelog is required'))
    generateUploadUrl.mockResolvedValue('https://upload.local')
    render(<Upload />)
    fireEvent.change(screen.getByPlaceholderText('my-skill-pack'), {
      target: { value: 'cool-skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('My Skill Pack'), {
      target: { value: 'Cool Skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('1.0.0'), {
      target: { value: '1.2.3' },
    })
    fireEvent.change(screen.getByPlaceholderText('latest, beta'), {
      target: { value: 'latest' },
    })
    fireEvent.change(screen.getByPlaceholderText('What changed in this version?'), {
      target: { value: 'Initial drop.' },
    })
    const file = new File(['hello'], 'SKILL.md', { type: 'text/markdown' })
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    const publishButton = screen.getByRole('button', { name: /publish/i }) as HTMLButtonElement
    await screen.findByText(/Ready to publish/i)
    fireEvent.click(publishButton)
    expect(await screen.findByText(/Changelog is required/i)).toBeTruthy()
  })
})
