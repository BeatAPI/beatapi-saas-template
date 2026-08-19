/**
 * PostgreSQL schema definitions (merged TanStack + BeatAPI).
 *
 * Set DATABASE_PROVIDER=postgres in .env.local,
 * then db-setup.mjs copies this into schema.ts.
 *
 * Merge strategy:
 * - user/session/account/verification: merged fields from both projects
 * - TanStack tables (config, taxonomy, post, order, subscription, credit, apikey,
 *   RBAC, aiTask, chat, ticket, inviteCode): kept as-is
 * - BeatAPI tables (payment, userCredit, creditTransaction, effect, project,
 *   generationHistory, userAsset, etc.): added below
 */

import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const table = pgTable;

// ─── Auth (merged) ───────────────────────────────────────────────────────────

export const user = table(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    // BeatAPI fields
    normalizedEmail: text('normalized_email').unique(),
    emailVerified: boolean('email_verified').notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    // BeatAPI role/ban fields
    role: text('role'),
    banned: boolean('banned'),
    banReason: text('ban_reason'),
    banExpires: timestamp('ban_expires'),
    // BeatAPI payment fields
    customerId: text('customer_id'),
    subscriptionState: text('subscription_state').notNull().default('free'),
  },
  (table) => [
    index('user_id_idx').on(table.id),
    index('user_customer_id_idx').on(table.customerId),
    index('user_role_idx').on(table.role),
    index('user_subscription_state_idx').on(table.subscriptionState),
    index('idx_user_name').on(table.name),
    index('idx_user_created_at').on(table.createdAt),
  ]
);

export const session = table(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    impersonatedBy: text('impersonated_by'),
  },
  (table) => [
    index('session_token_idx').on(table.token),
    index('session_user_id_idx').on(table.userId),
    index('idx_session_user_expires').on(table.userId, table.expiresAt),
  ]
);

export const account = table(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    index('account_account_id_idx').on(table.accountId),
    index('account_provider_id_idx').on(table.providerId),
    index('idx_account_provider_account').on(table.providerId, table.accountId),
  ]
);

export const verification = table(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
    index('idx_verification_identifier').on(table.identifier),
  ]
);

// ─── Content (TanStack) ──────────────────────────────────────────────────────

export const config = table('config', {
  name: text('name').unique().notNull(),
  value: text('value'),
});

export const taxonomy = table(
  'taxonomy',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    slug: text('slug').unique().notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    image: text('image'),
    icon: text('icon'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    sort: integer('sort').default(0).notNull(),
  },
  (table) => [
    index('idx_taxonomy_type_status').on(table.type, table.status),
  ]
);

export const post = table(
  'post',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    slug: text('slug').unique().notNull(),
    type: text('type').notNull(),
    title: text('title'),
    description: text('description'),
    image: text('image'),
    content: text('content'),
    categories: text('categories'),
    tags: text('tags'),
    authorName: text('author_name'),
    authorImage: text('author_image'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    sort: integer('sort').default(0).notNull(),
  },
  (table) => [
    index('idx_post_type_status').on(table.type, table.status),
  ]
);

// ─── Business: TanStack Payment ──────────────────────────────────────────────

export const order = table(
  'order',
  {
    id: text('id').primaryKey(),
    orderNo: text('order_no').unique().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: text('user_email'),
    status: text('status').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    productId: text('product_id'),
    paymentType: text('payment_type'),
    paymentInterval: text('payment_interval'),
    paymentProvider: text('payment_provider').notNull(),
    paymentSessionId: text('payment_session_id'),
    checkoutInfo: text('checkout_info').notNull(),
    checkoutResult: text('checkout_result'),
    paymentResult: text('payment_result'),
    discountCode: text('discount_code'),
    discountAmount: integer('discount_amount'),
    discountCurrency: text('discount_currency'),
    paymentEmail: text('payment_email'),
    paymentAmount: integer('payment_amount'),
    paymentCurrency: text('payment_currency'),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    description: text('description'),
    productName: text('product_name'),
    subscriptionId: text('subscription_id'),
    subscriptionResult: text('subscription_result'),
    checkoutUrl: text('checkout_url'),
    callbackUrl: text('callback_url'),
    creditsAmount: integer('credits_amount'),
    creditsValidDays: integer('credits_valid_days'),
    planName: text('plan_name'),
    paymentProductId: text('payment_product_id'),
    invoiceId: text('invoice_id'),
    invoiceUrl: text('invoice_url'),
    subscriptionNo: text('subscription_no'),
    transactionId: text('transaction_id'),
    paymentUserName: text('payment_user_name'),
    paymentUserId: text('payment_user_id'),
  },
  (table) => [
    index('idx_order_user_status_payment_type').on(
      table.userId,
      table.status,
      table.paymentType
    ),
    index('idx_order_transaction_provider').on(
      table.transactionId,
      table.paymentProvider
    ),
    index('idx_order_created_at').on(table.createdAt),
  ]
);

export const subscription = table(
  'subscription',
  {
    id: text('id').primaryKey(),
    subscriptionNo: text('subscription_no').unique().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: text('user_email'),
    status: text('status').notNull(),
    paymentProvider: text('payment_provider').notNull(),
    subscriptionId: text('subscription_id').notNull(),
    subscriptionResult: text('subscription_result'),
    productId: text('product_id'),
    description: text('description'),
    amount: integer('amount'),
    currency: text('currency'),
    interval: text('interval'),
    intervalCount: integer('interval_count'),
    trialPeriodDays: integer('trial_period_days'),
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    planName: text('plan_name'),
    billingUrl: text('billing_url'),
    productName: text('product_name'),
    creditsAmount: integer('credits_amount'),
    creditsValidDays: integer('credits_valid_days'),
    paymentProductId: text('payment_product_id'),
    paymentUserId: text('payment_user_id'),
    canceledAt: timestamp('canceled_at'),
    canceledEndAt: timestamp('canceled_end_at'),
    canceledReason: text('canceled_reason'),
    canceledReasonType: text('canceled_reason_type'),
  },
  (table) => [
    index('idx_subscription_user_status_interval').on(
      table.userId,
      table.status,
      table.interval
    ),
    index('idx_subscription_provider_id').on(
      table.subscriptionId,
      table.paymentProvider
    ),
    index('idx_subscription_created_at').on(table.createdAt),
  ]
);

export const paymentWebhookEvent = table(
  'payment_webhook_event',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    externalEventId: text('external_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: text('payload').notNull(),
    status: text('status').notNull().default('processing'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
  },
  (table) => [
    uniqueIndex('payment_webhook_event_provider_external_unique').on(
      table.provider,
      table.externalEventId
    ),
    index('payment_webhook_event_created_at_idx').on(table.createdAt),
  ]
);

// Durable commercial credit grants and FIFO consumption ledger.
export const credit = table(
  'credit',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: text('user_email'),
    orderNo: text('order_no'),
    subscriptionNo: text('subscription_no'),
    transactionNo: text('transaction_no').unique().notNull(),
    transactionType: text('transaction_type').notNull(),
    transactionScene: text('transaction_scene'),
    credits: integer('credits').notNull(),
    remainingCredits: integer('remaining_credits').notNull().default(0),
    description: text('description'),
    expiresAt: timestamp('expires_at'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    consumedDetail: text('consumed_detail'),
    metadata: text('metadata'),
  },
  (table) => [
    index('idx_credit_consume_fifo').on(
      table.userId,
      table.status,
      table.transactionType,
      table.remainingCredits,
      table.expiresAt
    ),
    index('idx_credit_order_no').on(table.orderNo),
    index('idx_credit_subscription_no').on(table.subscriptionNo),
  ]
);

export const apikey = table(
  'apikey',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    title: text('title').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('idx_apikey_user_status').on(table.userId, table.status),
    index('idx_apikey_keyhash_status').on(table.keyHash, table.status),
  ]
);

// ─── RBAC (TanStack) ─────────────────────────────────────────────────────────

export const role = table(
  'role',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    sort: integer('sort').default(0).notNull(),
  },
  (table) => [index('idx_role_status').on(table.status)]
);

export const permission = table(
  'permission',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_permission_resource_action').on(table.resource, table.action),
  ]
);

export const rolePermission = table(
  'role_permission',
  {
    id: text('id').primaryKey(),
    roleId: text('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permission.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('idx_role_permission_role_permission').on(
      table.roleId,
      table.permissionId
    ),
  ]
);

export const userRole = table(
  'user_role',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    expiresAt: timestamp('expires_at'),
  },
  (table) => [
    index('idx_user_role_user_expires').on(table.userId, table.expiresAt),
  ]
);

// ─── AI (TanStack) ───────────────────────────────────────────────────────────

export const aiTask = table(
  'ai_task',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    mediaType: text('media_type').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    prompt: text('prompt').notNull(),
    options: text('options'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    taskId: text('task_id'),
    taskInfo: text('task_info'),
    taskResult: text('task_result'),
    costCredits: integer('cost_credits').notNull().default(0),
    scene: text('scene').notNull().default(''),
    creditId: text('credit_id'),
  },
  (table) => [
    index('idx_ai_task_user_media_type').on(table.userId, table.mediaType),
    index('idx_ai_task_media_type_status').on(table.mediaType, table.status),
  ]
);

export const chat = table(
  'chat',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
    title: text('title').notNull().default(''),
    parts: text('parts').notNull(),
    metadata: text('metadata'),
    content: text('content'),
  },
  (table) => [index('idx_chat_user_status').on(table.userId, table.status)]
);

export const chatMessage = table(
  'chat_message',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatId: text('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    role: text('role').notNull(),
    parts: text('parts').notNull(),
    metadata: text('metadata'),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
  },
  (table) => [
    index('idx_chat_message_chat_id').on(table.chatId, table.status),
    index('idx_chat_message_user_id').on(table.userId, table.status),
  ]
);

// ─── Tickets (TanStack) ──────────────────────────────────────────────────────

export const ticket = table(
  'ticket',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    title: text('title').notNull(),
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_ticket_user').on(t.userId),
    index('idx_ticket_status').on(t.status),
  ]
);

export const ticketMessage = table(
  'ticket_message',
  {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => ticket.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    role: text('role').notNull().default('user'),
    content: text('content').notNull(),
    attachments: text('attachments').notNull().default('[]'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_ticket_message_ticket').on(t.ticketId)]
);

// ─── Invite Codes (TanStack) ─────────────────────────────────────────────────

export const inviteCode = table(
  'invite_code',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    maxUses: integer('max_uses').notNull().default(1),
    usedCount: integer('used_count').notNull().default(0),
    trialDays: integer('trial_days').notNull().default(15),
    note: text('note').default(''),
    createdBy: text('created_by').references(() => user.id),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_invite_code_code').on(t.code)]
);

export const userInvite = table(
  'user_invite',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    inviteCodeId: text('invite_code_id')
      .notNull()
      .references(() => inviteCode.id),
    activatedAt: timestamp('activated_at').defaultNow().notNull(),
    trialEndsAt: timestamp('trial_ends_at').notNull(),
  },
  (t) => [
    index('idx_user_invite_user').on(t.userId),
    index('idx_user_invite_code').on(t.inviteCodeId),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════════
// ─── BeatAPI Tables ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Workspace checkout and subscription projection ────────────────────────

export const payment = pgTable('payment', {
  id: text('id').primaryKey(),
  priceId: text('price_id').notNull(),
  type: text('type').notNull(),
  scene: text('scene'),
  interval: text('interval'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull(),
  subscriptionId: text('subscription_id'),
  sessionId: text('session_id').unique(),
  invoiceId: text('invoice_id').unique(),
  status: text('status').notNull(),
  paid: boolean('paid').notNull().default(false),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end'),
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
  creditsAnchorAt: timestamp('credits_anchor_at'),
  nextPriceId: text('next_price_id'),
  lastPlanChangeAt: timestamp('last_plan_change_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  paymentTypeIdx: index('payment_type_idx').on(table.type),
  paymentSceneIdx: index('payment_scene_idx').on(table.scene),
  paymentPriceIdIdx: index('payment_price_id_idx').on(table.priceId),
  paymentUserIdIdx: index('payment_user_id_idx').on(table.userId),
  paymentCustomerIdIdx: index('payment_customer_id_idx').on(table.customerId),
  paymentStatusIdx: index('payment_status_idx').on(table.status),
  paymentPaidIdx: index('payment_paid_idx').on(table.paid),
  paymentSubscriptionIdIdx: index('payment_subscription_id_idx').on(table.subscriptionId),
  paymentSessionIdIdx: index('payment_session_id_idx').on(table.sessionId),
  paymentInvoiceIdIdx: index('payment_invoice_id_idx').on(table.invoiceId),
  paymentNextPriceIdIdx: index('payment_next_price_id_idx').on(table.nextPriceId),
  paymentCreditsAnchorAtIdx: index('payment_credits_anchor_at_idx').on(table.creditsAnchorAt),
}));

// ─── Workspace balance projection and operational transaction log ───────────

export const userCredit = pgTable('user_credit', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  currentCredits: integer('current_credits').notNull().default(0),
  lastRefreshAt: timestamp('last_refresh_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userCreditUserIdIdx: index('user_credit_user_id_idx').on(table.userId),
  userCreditUserIdUidx: uniqueIndex('user_credit_user_id_uidx').on(table.userId),
}));

export const creditTransaction = pgTable('credit_transaction', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  description: text('description'),
  planId: text('plan_id'),
  priceId: text('price_id'),
  subscriptionId: text('subscription_id'),
  grantMonth: timestamp('grant_month'),
  amount: integer('amount').notNull(),
  remainingAmount: integer('remaining_amount'),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  expirationDate: timestamp('expiration_date'),
  expirationDateProcessedAt: timestamp('expiration_date_processed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  creditTransactionUserIdIdx: index('credit_transaction_user_id_idx').on(table.userId),
  creditTransactionTypeIdx: index('credit_transaction_type_idx').on(table.type),
  creditTransactionPlanIdIdx: index('credit_transaction_plan_id_idx').on(table.planId),
  creditTransactionGrantMonthIdx: index('credit_transaction_grant_month_idx').on(table.grantMonth),
  creditTransactionReferenceIdx: index('credit_transaction_reference_idx').on(table.referenceType, table.referenceId),
  creditTransactionReferenceUidx: uniqueIndex('credit_transaction_reference_uidx').on(table.userId, table.type, table.referenceType, table.referenceId).where(sql`${table.referenceType} IS NOT NULL AND ${table.referenceId} IS NOT NULL`),
}));

// ─── BeatAPI: Effects (AI model/effect registry) ─────────────────────────────

export const effect = pgTable('effect', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  type: integer('type').notNull(),
  model: text('model').notNull(),
  version: text('version'),
  credit: integer('credit').notNull(),
  linkName: text('link_name').notNull().unique(),
  prePrompt: text('pre_prompt'),
  description: text('des'),
  platform: text('platform'),
  api: text('api'),
  isOpen: integer('is_open').default(1),
  createdAt: timestamp('created_at').defaultNow(),
  provider: text('provider').notNull(),
  inputSchema: jsonb('input_schema'),
  pricingSchema: jsonb('pricing_schema'),
}, (table) => ({
  effectLinkNameIdx: index('effect_link_name_idx').on(table.linkName),
  effectProviderIdx: index('effect_provider_idx').on(table.provider),
}));

// ─── BeatAPI: Projects ───────────────────────────────────────────────────────

export const project = pgTable('project', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  coverAssetId: text('cover_asset_id'),
  status: text('status').notNull().default('active'),
  currentStateVersion: integer('current_state_version').notNull().default(1),
  lastWorkspaceMode: text('last_workspace_mode').notNull().default('canvas'),
  lastOpenedAt: timestamp('last_opened_at'),
  archivedAt: timestamp('archived_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectUserIdIdx: index('project_user_id_idx').on(table.userId),
  projectStatusIdx: index('project_status_idx').on(table.status),
  projectCurrentStateVersionIdx: index('project_current_state_version_idx').on(table.currentStateVersion),
  projectUpdatedAtIdx: index('project_updated_at_idx').on(table.updatedAt),
  projectLastOpenedAtIdx: index('project_last_opened_at_idx').on(table.lastOpenedAt),
  projectArchivedAtIdx: index('project_archived_at_idx').on(table.archivedAt),
}));

// ─── BeatAPI: User Assets ────────────────────────────────────────────────────

export const userAsset = pgTable('user_asset', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  source: text('source').notNull(),
  assetClass: text('asset_class').notNull().default('original'),
  storageProvider: text('storage_provider'),
  bucket: text('bucket').notNull(),
  objectKey: text('object_key').notNull(),
  publicUrl: text('public_url').notNull(),
  filename: text('filename'),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  sha256: text('sha256'),
  width: integer('width'),
  height: integer('height'),
  durationMs: integer('duration_ms'),
  originProjectId: text('origin_project_id').references(() => project.id, { onDelete: 'set null' }),
  thumbnailAssetId: text('thumbnail_asset_id').references((): AnyPgColumn => userAsset.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userAssetUserIdIdx: index('user_asset_user_id_idx').on(table.userId),
  userAssetTypeIdx: index('user_asset_type_idx').on(table.type),
  userAssetAssetClassIdx: index('user_asset_asset_class_idx').on(table.assetClass),
  userAssetStorageProviderIdx: index('user_asset_storage_provider_idx').on(table.storageProvider),
  userAssetOriginProjectIdIdx: index('user_asset_origin_project_id_idx').on(table.originProjectId),
  userAssetThumbnailAssetIdIdx: index('user_asset_thumbnail_asset_id_idx').on(table.thumbnailAssetId),
  userAssetCreatedAtIdx: index('user_asset_created_at_idx').on(table.createdAt),
  userAssetBucketObjectKeyUidx: uniqueIndex('user_asset_bucket_object_key_uidx').on(table.bucket, table.objectKey),
}));

// ─── BeatAPI: Generation History ─────────────────────────────────────────────

export const generationHistory = pgTable('generation_history', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => project.id, { onDelete: 'set null' }),
  effectId: integer('effect_id').notNull().references(() => effect.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  providerTaskId: text('provider_task_id'),
  lifecyclePhase: text('lifecycle_phase'),
  lastProviderSyncAt: timestamp('last_provider_sync_at'),
  executionMode: text('execution_mode').notNull().default('create_new'),
  submittedPrompt: text('submitted_prompt'),
  submittedParams: jsonb('submitted_params'),
  resultAssetId: text('result_asset_id').references((): AnyPgColumn => userAsset.id, { onDelete: 'set null' }),
  input: jsonb('input'),
  output: jsonb('output'),
  error: text('error'),
  creditsUsed: integer('credits_used').notNull().default(0),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  failedAt: timestamp('failed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  generationHistoryUserIdIdx: index('generation_history_user_id_idx').on(table.userId),
  generationHistoryProjectIdIdx: index('generation_history_project_id_idx').on(table.projectId),
  generationHistoryEffectIdIdx: index('generation_history_effect_id_idx').on(table.effectId),
  generationHistoryStatusIdx: index('generation_history_status_idx').on(table.status),
  generationHistoryProviderTaskIdIdx: index('generation_history_provider_task_id_idx').on(table.providerTaskId),
  generationHistoryLifecyclePhaseIdx: index('generation_history_lifecycle_phase_idx').on(table.lifecyclePhase),
  generationHistoryResultAssetIdIdx: index('generation_history_result_asset_id_idx').on(table.resultAssetId),
  generationHistoryStatusLifecycleIdx: index('generation_history_status_lifecycle_idx').on(table.status, table.lifecyclePhase),
  generationHistoryStatusLastSyncIdx: index('generation_history_status_last_provider_sync_idx').on(table.status, table.lastProviderSyncAt),
}));

// ─── BeatAPI: Generation Asset Links ─────────────────────────────────────────

export const generationAssetLink = pgTable('generation_asset_link', {
  id: text('id').primaryKey(),
  generationId: text('generation_id').notNull().references(() => generationHistory.id, { onDelete: 'cascade' }),
  assetId: text('asset_id').notNull().references(() => userAsset.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  generationAssetLinkGenerationIdx: index('generation_asset_link_generation_idx').on(table.generationId),
  generationAssetLinkAssetIdx: index('generation_asset_link_asset_idx').on(table.assetId),
  generationAssetLinkUnique: uniqueIndex('generation_asset_link_unique').on(table.generationId, table.assetId, table.role),
}));

// ─── BeatAPI: Provider Callback Nonce ────────────────────────────────────────

export const providerCallbackNonce = pgTable('provider_callback_nonce', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  nonce: text('nonce').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  providerCallbackNonceProviderIdx: index('provider_callback_nonce_provider_idx').on(table.provider),
  providerCallbackNonceExpiresAtIdx: index('provider_callback_nonce_expires_at_idx').on(table.expiresAt),
  providerCallbackNonceUnique: uniqueIndex('provider_callback_nonce_unique').on(table.provider, table.nonce),
}));

// ─── BeatAPI: Project Canvas State ───────────────────────────────────────────

export const projectCanvasState = pgTable('project_canvas_state', {
  projectId: text('project_id').primaryKey().references(() => project.id, { onDelete: 'cascade' }),
  documentJson: jsonb('document_json').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectCanvasStateUpdatedAtIdx: index('project_canvas_state_updated_at_idx').on(table.updatedAt),
}));

// ─── BeatAPI: Project Workflow State ─────────────────────────────────────────

export const projectWorkflowState = pgTable('project_workflow_state', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  workflowType: text('workflow_type').notNull(),
  workflowInstanceId: text('workflow_instance_id').notNull(),
  templateSlug: text('template_slug'),
  status: text('status').notNull().default('draft'),
  formJson: jsonb('form_json'),
  layoutJson: jsonb('layout_json'),
  selectionJson: jsonb('selection_json'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectWorkflowStateProjectIdx: index('project_workflow_state_project_idx').on(table.projectId),
  projectWorkflowStateWorkflowTypeIdx: index('project_workflow_state_workflow_type_idx').on(table.workflowType),
  projectWorkflowStateTemplateSlugIdx: index('project_workflow_state_template_slug_idx').on(table.templateSlug),
  projectWorkflowStateUpdatedAtIdx: index('project_workflow_state_updated_at_idx').on(table.updatedAt),
  projectWorkflowStateUnique: uniqueIndex('project_workflow_state_unique').on(table.projectId, table.workflowType, table.workflowInstanceId),
}));

// ─── BeatAPI: Project Asset Membership ───────────────────────────────────────

export const projectAssetMembership = pgTable('project_asset_membership', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  assetId: text('asset_id').notNull().references(() => userAsset.id, { onDelete: 'cascade' }),
  sourceRunId: text('source_run_id').references(() => generationHistory.id, { onDelete: 'set null' }),
  category: text('category').notNull(),
  workflowType: text('workflow_type'),
  workflowInstanceId: text('workflow_instance_id'),
  slotId: text('slot_id'),
  role: text('role'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  projectAssetMembershipProjectIdx: index('project_asset_membership_project_idx').on(table.projectId),
  projectAssetMembershipAssetIdx: index('project_asset_membership_asset_idx').on(table.assetId),
  projectAssetMembershipSourceRunIdx: index('project_asset_membership_source_run_idx').on(table.sourceRunId),
  projectAssetMembershipCategoryIdx: index('project_asset_membership_category_idx').on(table.category),
  projectAssetMembershipWorkflowIdx: index('project_asset_membership_workflow_idx').on(table.workflowType, table.workflowInstanceId),
  projectAssetMembershipSlotIdx: index('project_asset_membership_slot_idx').on(table.slotId),
  projectAssetMembershipUnique: uniqueIndex('project_asset_membership_unique').on(table.projectId, table.assetId, table.category),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type Config = typeof config.$inferSelect;
export type Taxonomy = typeof taxonomy.$inferSelect;
export type NewTaxonomy = typeof taxonomy.$inferInsert;
export type Post = typeof post.$inferSelect;
export type NewPost = typeof post.$inferInsert;
export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
export type Subscription = typeof subscription.$inferSelect;
export type NewSubscription = typeof subscription.$inferInsert;
export type PaymentWebhookEvent = typeof paymentWebhookEvent.$inferSelect;
export type Credit = typeof credit.$inferSelect;
export type NewCredit = typeof credit.$inferInsert;
export type Apikey = typeof apikey.$inferSelect;
export type NewApikey = typeof apikey.$inferInsert;
export type Role = typeof role.$inferSelect;
export type NewRole = typeof role.$inferInsert;
export type Permission = typeof permission.$inferSelect;
export type RolePermission = typeof rolePermission.$inferSelect;
export type UserRole = typeof userRole.$inferSelect;
export type AiTask = typeof aiTask.$inferSelect;
export type NewAiTask = typeof aiTask.$inferInsert;
export type Chat = typeof chat.$inferSelect;
export type NewChat = typeof chat.$inferInsert;
export type ChatMessage = typeof chatMessage.$inferSelect;
export type NewChatMessage = typeof chatMessage.$inferInsert;
export type Ticket = typeof ticket.$inferSelect;
export type NewTicket = typeof ticket.$inferInsert;
export type TicketMessage = typeof ticketMessage.$inferSelect;
export type NewTicketMessage = typeof ticketMessage.$inferInsert;
export type InviteCode = typeof inviteCode.$inferSelect;
export type NewInviteCode = typeof inviteCode.$inferInsert;
export type UserInvite = typeof userInvite.$inferSelect;
export type NewUserInvite = typeof userInvite.$inferInsert;

// BeatAPI types
export type Payment = typeof payment.$inferSelect;
export type NewPayment = typeof payment.$inferInsert;
export type UserCredit = typeof userCredit.$inferSelect;
export type NewUserCredit = typeof userCredit.$inferInsert;
export type CreditTransaction = typeof creditTransaction.$inferSelect;
export type NewCreditTransaction = typeof creditTransaction.$inferInsert;
export type Effect = typeof effect.$inferSelect;
export type NewEffect = typeof effect.$inferInsert;
export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
export type UserAsset = typeof userAsset.$inferSelect;
export type NewUserAsset = typeof userAsset.$inferInsert;
export type GenerationHistory = typeof generationHistory.$inferSelect;
export type NewGenerationHistory = typeof generationHistory.$inferInsert;
export type GenerationAssetLink = typeof generationAssetLink.$inferSelect;
export type NewGenerationAssetLink = typeof generationAssetLink.$inferInsert;
export type ProviderCallbackNonce = typeof providerCallbackNonce.$inferSelect;
export type ProjectCanvasState = typeof projectCanvasState.$inferSelect;
export type NewProjectCanvasState = typeof projectCanvasState.$inferInsert;
export type ProjectWorkflowState = typeof projectWorkflowState.$inferSelect;
export type NewProjectWorkflowState = typeof projectWorkflowState.$inferInsert;
export type ProjectAssetMembership = typeof projectAssetMembership.$inferSelect;
export type NewProjectAssetMembership = typeof projectAssetMembership.$inferInsert;
