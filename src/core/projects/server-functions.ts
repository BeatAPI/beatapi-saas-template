import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const loadProjectsForUserSchema = z.object({
  userId: z.string().min(1),
  limit: z.number().int().positive().optional(),
});

const loadProjectWithLatestSnapshotSchema = z.object({
  userId: z.string().min(1),
  projectId: z.string().min(1),
});

export const loadSerializedProjectsForUserFn = createServerFn()
  .inputValidator(loadProjectsForUserSchema)
  .handler(async ({ data }) => {
    const [{ loadProjectsForUser }, { serializeProjectCenterCard }] =
      await Promise.all([
        import('./projects'),
        import('./project-entry'),
      ]);
    const projects = await loadProjectsForUser({
      userId: data.userId,
      limit: data.limit,
    });
    return projects.map(serializeProjectCenterCard);
  });

export const loadProjectWithLatestSnapshotFn = createServerFn()
  .inputValidator(loadProjectWithLatestSnapshotSchema)
  .handler(async ({ data }) => {
    const { loadProjectWithLatestSnapshot } = await import('./projects');
    return loadProjectWithLatestSnapshot({
      userId: data.userId,
      projectId: data.projectId,
    });
  });
