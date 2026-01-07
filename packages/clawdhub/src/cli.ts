#!/usr/bin/env node
import { resolve } from 'node:path'
import { Command } from 'commander'
import { getCliBuildLabel, getCliVersion } from './cli/buildInfo.js'
import { cmdLoginFlow, cmdLogout, cmdWhoami } from './cli/commands/auth.js'
import { cmdDeleteSkill, cmdUndeleteSkill } from './cli/commands/delete.js'
import { cmdPublish } from './cli/commands/publish.js'
import { cmdInstall, cmdList, cmdSearch, cmdUpdate } from './cli/commands/skills.js'
import { cmdSync } from './cli/commands/sync.js'
import { configureCommanderHelp, styleEnvBlock, styleTitle } from './cli/helpStyle.js'
import { DEFAULT_REGISTRY, DEFAULT_SITE } from './cli/registry.js'
import type { GlobalOpts } from './cli/types.js'
import { fail } from './cli/ui.js'
import { readGlobalConfig } from './config.js'

const program = new Command()
  .name('clawdhub')
  .description(
    `${styleTitle(`ClawdHub CLI ${getCliBuildLabel()}`)}\n${styleEnvBlock(
      'install, update, search, and publish agent skills.',
    )}`,
  )
  .version(getCliVersion(), '-V, --cli-version', 'Show CLI version')
  .option('--workdir <dir>', 'Working directory (default: cwd)')
  .option('--dir <dir>', 'Skills directory (relative to workdir, default: skills)')
  .option('--site <url>', 'Site base URL (for browser login)')
  .option('--registry <url>', 'Registry API base URL')
  .option('--no-input', 'Disable prompts')
  .showHelpAfterError()
  .showSuggestionAfterError()
  .addHelpText('after', styleEnvBlock('\nEnv:\n  CLAWDHUB_SITE\n  CLAWDHUB_REGISTRY\n'))

configureCommanderHelp(program)

function resolveGlobalOpts(): GlobalOpts {
  const raw = program.opts<{ workdir?: string; dir?: string; site?: string; registry?: string }>()
  const workdir = resolve(raw.workdir ?? process.cwd())
  const dir = resolve(workdir, raw.dir ?? 'skills')
  const site = raw.site ?? process.env.CLAWDHUB_SITE ?? DEFAULT_SITE
  const registrySource = raw.registry ? 'cli' : process.env.CLAWDHUB_REGISTRY ? 'env' : 'default'
  const registry = raw.registry ?? process.env.CLAWDHUB_REGISTRY ?? DEFAULT_REGISTRY
  return { workdir, dir, site, registry, registrySource }
}

function isInputAllowed() {
  const globalFlags = program.opts<{ input?: boolean }>()
  return globalFlags.input !== false
}

program
  .command('login')
  .description('Log in (opens browser or stores token)')
  .option('--token <token>', 'API token')
  .option('--label <label>', 'Token label (browser flow only)', 'CLI token')
  .option('--no-browser', 'Do not open browser (requires --token)')
  .action(async (options) => {
    const opts = resolveGlobalOpts()
    await cmdLoginFlow(opts, options, isInputAllowed())
  })

program
  .command('logout')
  .description('Remove stored token')
  .action(async () => {
    const opts = resolveGlobalOpts()
    await cmdLogout(opts)
  })

program
  .command('whoami')
  .description('Validate token')
  .action(async () => {
    const opts = resolveGlobalOpts()
    await cmdWhoami(opts)
  })

const auth = program
  .command('auth')
  .description('Authentication commands')
  .showHelpAfterError()
  .showSuggestionAfterError()

auth
  .command('login')
  .description('Log in (opens browser or stores token)')
  .option('--token <token>', 'API token')
  .option('--label <label>', 'Token label (browser flow only)', 'CLI token')
  .option('--no-browser', 'Do not open browser (requires --token)')
  .action(async (options) => {
    const opts = resolveGlobalOpts()
    await cmdLoginFlow(opts, options, isInputAllowed())
  })

auth
  .command('logout')
  .description('Remove stored token')
  .action(async () => {
    const opts = resolveGlobalOpts()
    await cmdLogout(opts)
  })

auth
  .command('whoami')
  .description('Validate token')
  .action(async () => {
    const opts = resolveGlobalOpts()
    await cmdWhoami(opts)
  })

program
  .command('search')
  .description('Vector search skills')
  .argument('<query...>', 'Query string')
  .option('--limit <n>', 'Max results', (value) => Number.parseInt(value, 10))
  .action(async (queryParts, options) => {
    const opts = resolveGlobalOpts()
    const query = queryParts.join(' ').trim()
    await cmdSearch(opts, query, options.limit)
  })

program
  .command('install')
  .description('Install into <dir>/<slug>')
  .argument('<slug>', 'Skill slug')
  .option('--version <version>', 'Version to install')
  .option('--force', 'Overwrite existing folder')
  .action(async (slug, options) => {
    const opts = resolveGlobalOpts()
    await cmdInstall(opts, slug, options.version, options.force)
  })

program
  .command('update')
  .description('Update installed skills')
  .argument('[slug]', 'Skill slug')
  .option('--all', 'Update all installed skills')
  .option('--version <version>', 'Update to specific version (single slug only)')
  .option('--force', 'Overwrite when local files do not match any version')
  .action(async (slug, options) => {
    const opts = resolveGlobalOpts()
    await cmdUpdate(opts, slug, options, isInputAllowed())
  })

program
  .command('list')
  .description('List installed skills (from lockfile)')
  .action(async () => {
    const opts = resolveGlobalOpts()
    await cmdList(opts)
  })

program
  .command('publish')
  .description('Publish skill from folder')
  .argument('<path>', 'Skill folder path')
  .option('--slug <slug>', 'Skill slug')
  .option('--name <name>', 'Display name')
  .option('--version <version>', 'Version (semver)')
  .option('--fork-of <slug[@version]>', 'Mark as a fork of an existing skill')
  .option('--changelog <text>', 'Changelog text')
  .option('--tags <tags>', 'Comma-separated tags', 'latest')
  .action(async (folder, options) => {
    const opts = resolveGlobalOpts()
    await cmdPublish(opts, folder, options)
  })

program
  .command('delete')
  .description('Soft-delete a skill (owner/admin only)')
  .argument('<slug>', 'Skill slug')
  .option('--yes', 'Skip confirmation')
  .action(async (slug, options) => {
    const opts = resolveGlobalOpts()
    await cmdDeleteSkill(opts, slug, options, isInputAllowed())
  })

program
  .command('undelete')
  .description('Restore a soft-deleted skill (owner/admin only)')
  .argument('<slug>', 'Skill slug')
  .option('--yes', 'Skip confirmation')
  .action(async (slug, options) => {
    const opts = resolveGlobalOpts()
    await cmdUndeleteSkill(opts, slug, options, isInputAllowed())
  })

program
  .command('sync')
  .description('Scan local skills and publish new/updated ones')
  .option('--root <dir...>', 'Extra scan roots (one or more)')
  .option('--all', 'Upload all new/updated skills without prompting')
  .option('--dry-run', 'Show what would be uploaded')
  .option('--bump <type>', 'Version bump for updates (patch|minor|major)', 'patch')
  .option('--changelog <text>', 'Changelog to use for updates (non-interactive)')
  .option('--tags <tags>', 'Comma-separated tags', 'latest')
  .option('--concurrency <n>', 'Concurrent registry checks (default: 4)', '4')
  .action(async (options) => {
    const opts = resolveGlobalOpts()
    const bump = String(options.bump ?? 'patch') as 'patch' | 'minor' | 'major'
    if (!['patch', 'minor', 'major'].includes(bump)) fail('--bump must be patch|minor|major')
    const concurrencyRaw = Number(options.concurrency ?? 4)
    const concurrency = Number.isFinite(concurrencyRaw) ? Math.round(concurrencyRaw) : 4
    if (concurrency < 1 || concurrency > 32) fail('--concurrency must be between 1 and 32')
    await cmdSync(
      opts,
      {
        root: options.root,
        all: options.all,
        dryRun: options.dryRun,
        bump,
        changelog: options.changelog,
        tags: options.tags,
        concurrency,
      },
      isInputAllowed(),
    )
  })

program.action(async () => {
  const opts = resolveGlobalOpts()
  const cfg = await readGlobalConfig()
  if (cfg?.token) {
    await cmdSync(opts, {}, isInputAllowed())
    return
  }
  program.outputHelp()
  process.exitCode = 0
})

void program.parseAsync(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  fail(message)
})
