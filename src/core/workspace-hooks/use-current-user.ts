import { authClient } from '@/core/workspace-lib/auth-client';

export const useCurrentUser = () => {
  const { data: session } = authClient.useSession();
  return session?.user;
};
