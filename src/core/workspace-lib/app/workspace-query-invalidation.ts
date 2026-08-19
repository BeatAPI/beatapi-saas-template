import { creditsKeys } from '@/core/workspace-hooks/use-credits';
import { paymentKeys } from '@/core/workspace-hooks/use-payment';
import type { QueryClient } from '@tanstack/react-query';
import {
  effectMetadataKeys,
  generationStatusKeys,
  recentAssetsKeys,
  workspaceModelsKeys,
  workspaceProjectsKeys,
} from './workspace-query-keys';

export async function invalidateWorkspaceAfterGeneration(
  queryClient: QueryClient
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: creditsKeys.all }),
    queryClient.invalidateQueries({ queryKey: recentAssetsKeys.all }),
    queryClient.invalidateQueries({ queryKey: workspaceProjectsKeys.all }),
    queryClient.invalidateQueries({ queryKey: generationStatusKeys.all }),
  ]);
}

export async function invalidateWorkspaceAfterAssetMutation(
  queryClient: QueryClient
) {
  await queryClient.invalidateQueries({ queryKey: recentAssetsKeys.all });
}

export async function invalidateWorkspaceAfterProjectMutation(
  queryClient: QueryClient
) {
  await queryClient.invalidateQueries({ queryKey: workspaceProjectsKeys.all });
}

export async function invalidateWorkspaceMetadata(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: workspaceModelsKeys.all }),
    queryClient.invalidateQueries({ queryKey: effectMetadataKeys.all }),
  ]);
}

export async function invalidateWorkspaceAfterPaymentChange(
  queryClient: QueryClient
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: creditsKeys.all }),
    queryClient.invalidateQueries({ queryKey: paymentKeys.all }),
  ]);
}

export async function invalidateWorkspaceAfterAuthChange(
  queryClient: QueryClient
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: creditsKeys.all }),
    queryClient.invalidateQueries({ queryKey: paymentKeys.all }),
    queryClient.invalidateQueries({ queryKey: recentAssetsKeys.all }),
    queryClient.invalidateQueries({ queryKey: workspaceProjectsKeys.all }),
  ]);
}
