import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { getAllConfigs } from '@/modules/config/service';
import { getBalance, grantForNewUser } from '@/modules/credits/service';
import {
  addRegisterGiftCredits,
  getUserCredits,
} from '@/core/workspace-credits/credits';
import { respData, respInternalError, respUnauthorized } from '@/lib/resp';

async function POST({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respUnauthorized();

    const configs = await getAllConfigs();
    await grantForNewUser({
      userId: session.user.id,
      userEmail: session.user.email,
      configs,
    });
    await addRegisterGiftCredits(session.user.id, {
      amount: Number.parseInt(configs.initial_credits_amount || '0', 10),
      expireDays: Number.parseInt(configs.initial_credits_valid_days || '0', 10),
    });

    return respData({
      credits: await getUserCredits(session.user.id),
      apiCredits: await getBalance(session.user.id),
    });
  } catch (error) {
    console.error('welcome credits error:', error);
    return respInternalError('Failed to grant welcome credits');
  }
}

export const Route = createFileRoute('/api/credits/welcome')({
  server: { handlers: { POST } },
});
