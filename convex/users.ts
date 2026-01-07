import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { assertRole, requireUser } from './lib/access'

const DEFAULT_ROLE = 'user'
const ADMIN_HANDLE = 'steipete'

export const getById = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => ctx.db.get(args.userId),
})

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const user = await ctx.db.get(userId)
    if (!user || user.deletedAt) return null
    return user
  },
})

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireUser(ctx)
    const now = Date.now()
    const updates: Record<string, unknown> = {}

    const handle = user.handle ?? user.name ?? user.email?.split('@')[0]
    if (!user.handle && handle) updates.handle = handle
    if (!user.displayName) updates.displayName = handle
    if (!user.role) {
      updates.role = handle === ADMIN_HANDLE ? 'admin' : DEFAULT_ROLE
    }
    if (!user.createdAt) updates.createdAt = user._creationTime
    updates.updatedAt = now

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(userId, updates)
    }

    return ctx.db.get(userId)
  },
})

export const updateProfile = mutation({
  args: {
    displayName: v.string(),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    await ctx.db.patch(userId, {
      displayName: args.displayName.trim(),
      bio: args.bio?.trim(),
      updatedAt: Date.now(),
    })
  },
})

export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    await ctx.db.patch(userId, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    })
    await ctx.runMutation(internal.telemetry.clearUserTelemetryInternal, { userId })
  },
})

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx)
    assertRole(user, ['admin'])
    const limit = args.limit ?? 50
    return ctx.db.query('users').order('desc').take(limit)
  },
})

export const getByHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('users')
      .withIndex('handle', (q) => q.eq('handle', args.handle))
      .unique()
  },
})

export const setRole = mutation({
  args: {
    userId: v.id('users'),
    role: v.union(v.literal('admin'), v.literal('moderator'), v.literal('user')),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx)
    assertRole(user, ['admin'])
    await ctx.db.patch(args.userId, { role: args.role, updatedAt: Date.now() })
    await ctx.db.insert('auditLogs', {
      actorUserId: user._id,
      action: 'role.change',
      targetType: 'user',
      targetId: args.userId,
      metadata: { role: args.role },
      createdAt: Date.now(),
    })
  },
})
