import { createFileRoute } from '@tanstack/react-router';
import { respData, respErr } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { hasPermission } from '@/modules/rbac/service';
import { getAllConfigs } from '@/modules/config/service';
import { runTest, getTestSpec } from '@/modules/config/settings-test';

async function POST({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized', 401);

    const isAdmin = await hasPermission(session.user.id, 'admin.settings.write');
    if (!isAdmin) return respErr('Forbidden', 403);

    const body = await request.json();
    const group: string = body?.group;
    const inputs: Record<string, string> = body?.inputs || {};
    if (!group) return respErr('group is required');

    const spec = getTestSpec(group);
    if (!spec) return respErr(`No test available for "${group}"`);

    for (const field of spec.fields) {
      if (field.required && !inputs[field.name]) {
        return respErr(`Missing required field: ${field.label}`);
      }
    }

    const configs = await getAllConfigs();
    const result = await runTest(group, inputs, configs);
    return respData(result);
  } catch (error: any) {
    return respErr('Internal error', 500);
  }
}

export const Route = createFileRoute('/api/admin/settings/test')({
  server: {
    handlers: { POST },
  },
});
