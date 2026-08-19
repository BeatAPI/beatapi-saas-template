
import { randomUUID } from 'crypto';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { generationHistory } from '@/config/db/schema';
import { deriveGenerationOperationalFields } from '@/core/effects/generation-operational-fields';
import { and, desc, eq, inArray, not, sql } from 'drizzle-orm';

export type GenerationStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed';

const TERMINAL_GENERATION_STATUSES: GenerationStatus[] = [
  'succeeded',
  'failed',
];
const NON_TERMINAL_GENERATION_STATUSES: GenerationStatus[] = [
  'pending',
  'processing',
];

const extractSubmittedPrompt = (input: unknown) => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const prompt = (input as Record<string, unknown>).prompt;
  return typeof prompt === 'string' && prompt.trim().length > 0
    ? prompt.trim()
    : null;
};

const resolveGenerationStatusTimestamps = (status: GenerationStatus) => {
  const now = new Date();

  if (status === 'failed') {
    return {
      startedAt: now,
      completedAt: null,
      failedAt: now,
    };
  }

  if (status === 'succeeded') {
    return {
      startedAt: now,
      completedAt: now,
      failedAt: null,
    };
  }

  return {
    startedAt: now,
    completedAt: null,
    failedAt: null,
  };
};

export const recordGeneration = async ({
  userId,
  projectId,
  effectId,
  status,
  input,
  output,
  error,
  creditsUsed = 0,
}: {
  userId: string;
  projectId?: string | null;
  effectId: number;
  status: GenerationStatus;
  input?: unknown;
  output?: unknown;
  error?: string | null;
  creditsUsed?: number;
}) => {
  const id = randomUUID();
  try {
    const db = await getDb();
    const operationalFields = deriveGenerationOperationalFields({ output });
    const statusTimestamps = resolveGenerationStatusTimestamps(status);
    await db.insert(generationHistory).values({
      id,
      userId,
      projectId: projectId ?? null,
      effectId,
      status,
      providerTaskId: operationalFields.providerTaskId ?? null,
      lifecyclePhase: operationalFields.lifecyclePhase ?? null,
      lastProviderSyncAt: operationalFields.lastProviderSyncAt,
      executionMode: 'create_new',
      submittedPrompt: extractSubmittedPrompt(input),
      submittedParams: input ?? null,
      input: input ?? null,
      output: output ?? null,
      error: error ?? null,
      creditsUsed,
      startedAt: statusTimestamps.startedAt,
      completedAt: statusTimestamps.completedAt,
      failedAt: statusTimestamps.failedAt,
      createdAt: new Date(),
    });
    return id;
  } catch (recordError) {
    console.error('recordGeneration error:', recordError);
    return null;
  }
};

const RUNNING_GENERATION_STATUSES = sql`('pending', 'processing')`;

export const countRunningGenerationsForProject = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}) => {
  try {
    const db = await getDb();
    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(generationHistory)
      .where(
        and(
          eq(generationHistory.userId, userId),
          eq(generationHistory.projectId, projectId),
          sql`${generationHistory.status} in ${RUNNING_GENERATION_STATUSES}`
        )
      )
      .limit(1);

    return rows[0]?.count ?? 0;
  } catch (error) {
    console.error('countRunningGenerationsForProject error:', error);
    return 0;
  }
};

export const findActiveProjectForUser = async ({
  userId,
}: {
  userId: string;
}) => {
  try {
    const db = await getDb();
    const rows = await db
      .select({ projectId: generationHistory.projectId })
      .from(generationHistory)
      .where(
        and(
          eq(generationHistory.userId, userId),
          sql`${generationHistory.status} in ${RUNNING_GENERATION_STATUSES}`,
          sql`${generationHistory.projectId} is not null`
        )
      )
      .orderBy(desc(generationHistory.createdAt))
      .limit(1);

    return rows[0]?.projectId ?? null;
  } catch (error) {
    console.error('findActiveProjectForUser error:', error);
    return null;
  }
};

export const updateGenerationById = async ({
  id,
  status,
  output,
  error,
  creditsUsed,
}: {
  id: string;
  status: GenerationStatus;
  output?: unknown;
  error?: string | null;
  creditsUsed?: number;
}) => {
  try {
    const db = await getDb();
    const operationalFields = deriveGenerationOperationalFields({ output });
    const completedAt = status === 'succeeded' ? new Date() : null;
    const failedAt = status === 'failed' ? new Date() : null;
    await db
      .update(generationHistory)
      .set({
        status,
        providerTaskId: operationalFields.providerTaskId ?? null,
        lifecyclePhase: operationalFields.lifecyclePhase ?? null,
        lastProviderSyncAt: operationalFields.lastProviderSyncAt ?? null,
        output: output ?? null,
        error: error ?? null,
        startedAt: sql`coalesce(${generationHistory.startedAt}, now())`,
        completedAt,
        failedAt,
        ...(creditsUsed !== undefined ? { creditsUsed } : {}),
      })
      .where(
        and(
          eq(generationHistory.id, id),
          status === 'pending' || status === 'processing'
            ? not(
                inArray(generationHistory.status, TERMINAL_GENERATION_STATUSES)
              )
            : inArray(
                generationHistory.status,
                NON_TERMINAL_GENERATION_STATUSES
              )
        )
      );
    return true;
  } catch (updateError) {
    console.error('updateGenerationById error:', updateError);
    return false;
  }
};

export const updateGenerationByTaskId = async ({
  userId,
  effectId,
  taskId,
  status,
  output,
  error,
}: {
  userId: string;
  effectId: number;
  taskId: string;
  status: GenerationStatus;
  output?: unknown;
  error?: string | null;
}) => {
  try {
    const db = await getDb();

    const row = await db
      .select({ id: generationHistory.id })
      .from(generationHistory)
      .where(
        and(
          eq(generationHistory.userId, userId),
          eq(generationHistory.effectId, effectId),
          sql`coalesce(${generationHistory.providerTaskId}, ${generationHistory.output} ->> 'taskId', ${generationHistory.input} ->> 'taskId') = ${taskId}`
        )
      )
      .orderBy(desc(generationHistory.createdAt))
      .limit(1);

    const record = row[0];
    if (!record) {
      return false;
    }

    const operationalFields = deriveGenerationOperationalFields({ output });
    const completedAt = status === 'succeeded' ? new Date() : null;
    const failedAt = status === 'failed' ? new Date() : null;
    await db
      .update(generationHistory)
      .set({
        status,
        providerTaskId: operationalFields.providerTaskId ?? null,
        lifecyclePhase: operationalFields.lifecyclePhase ?? null,
        lastProviderSyncAt: operationalFields.lastProviderSyncAt ?? null,
        output: output ?? null,
        error: error ?? null,
        startedAt: sql`coalesce(${generationHistory.startedAt}, now())`,
        completedAt,
        failedAt,
      })
      .where(eq(generationHistory.id, record.id));

    return true;
  } catch (updateError) {
    console.error('updateGenerationByTaskId error:', updateError);
    return false;
  }
};

export const updateGenerationByTaskIdGlobal = async ({
  taskId,
  status,
  output,
  error,
}: {
  taskId: string;
  status: GenerationStatus;
  output?: unknown;
  error?: string | null;
}) => {
  try {
    const db = await getDb();
    const row = await db
      .select({ id: generationHistory.id })
      .from(generationHistory)
      .where(
        sql`coalesce(${generationHistory.providerTaskId}, ${generationHistory.output} ->> 'taskId', ${generationHistory.input} ->> 'taskId') = ${taskId}`
      )
      .orderBy(desc(generationHistory.createdAt))
      .limit(1);

    const record = row[0];
    if (!record) return false;

    const operationalFields = deriveGenerationOperationalFields({ output });
    const completedAt = status === 'succeeded' ? new Date() : null;
    const failedAt = status === 'failed' ? new Date() : null;
    await db
      .update(generationHistory)
      .set({
        status,
        providerTaskId: operationalFields.providerTaskId ?? null,
        lifecyclePhase: operationalFields.lifecyclePhase ?? null,
        lastProviderSyncAt: operationalFields.lastProviderSyncAt ?? null,
        output: output ?? null,
        error: error ?? null,
        startedAt: sql`coalesce(${generationHistory.startedAt}, now())`,
        completedAt,
        failedAt,
      })
      .where(eq(generationHistory.id, record.id));

    return true;
  } catch (updateError) {
    console.error('updateGenerationByTaskIdGlobal error:', updateError);
    return false;
  }
};

export const getGenerationById = async ({
  id,
  userId,
  effectId,
}: {
  id: string;
  userId: string;
  effectId?: number;
}) => {
  try {
    const db = await getDb();
    const whereConditions = [
      eq(generationHistory.id, id),
      eq(generationHistory.userId, userId),
    ];
    if (effectId !== undefined) {
      whereConditions.push(eq(generationHistory.effectId, effectId));
    }
    const rows = await db
      .select()
      .from(generationHistory)
      .where(and(...whereConditions))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('getGenerationById error:', error);
    return null;
  }
};

export const getGenerationByProviderTaskIdGlobal = async ({
  taskId,
}: {
  taskId: string;
}) => {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(generationHistory)
      .where(
        sql`coalesce(${generationHistory.providerTaskId}, ${generationHistory.output} ->> 'providerTaskId', ${generationHistory.output} ->> 'taskId', ${generationHistory.input} ->> 'taskId') = ${taskId}`
      )
      .orderBy(desc(generationHistory.createdAt))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('getGenerationByProviderTaskIdGlobal error:', error);
    return null;
  }
};
