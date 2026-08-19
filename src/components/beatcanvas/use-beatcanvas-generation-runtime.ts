
import { useEffectMetadata } from '@/core/workspace-hooks/use-workspace-metadata';
import type { WorkspaceModelOption } from '@/core/effects/workspace-models';
import type {
  CanvasCard,
  CanvasDraftCard,
  CanvasOutputCard,
} from '@/core/beatcanvas/canvas-types';
import {
  isCanvasDraftCard,
  isCanvasOutputCard,
} from '@/core/beatcanvas/canvas-types';
import { resolveOutputMedia } from '@/core/effects/output-media';
import {
  type StudioJobStatus,
  buildGenerationEffectInput,
  getJobStatusLabel,
  getSelectableModel,
  pollGenerationUntilComplete,
  runDraftGeneration,
} from '@/core/beatcanvas/generation-controller';
import {
  buildEffectMetadataMap,
  getDraftUploadFailureMessage,
} from '@/core/beatcanvas/studio/generation-runtime';
import type { MutableRefObject } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';

import type { StudioTranslateFn } from './beatcanvas-types';

type GenerateDraftOptions = {
  suppressSuccessToast?: boolean;
  suppressResultFocus?: boolean;
  batchIndex?: number;
  batchTotal?: number;
};

export function useBeatCanvasGenerationRuntime({
  projectId,
  studioT,
  canvasCardsRef,
  imageModels,
  isCanvasReady = true,
  videoModels,
  promotePendingUploadsForDraft,
  createGenerationOutput,
  updateGenerationOutput,
  completeGenerationOutput,
  setErrorMessage,
  setStatusMessage,
  updateDraftCard,
  onCreditBalanceMayChange,
}: {
  projectId: string;
  studioT: StudioTranslateFn;
  canvasCardsRef: MutableRefObject<Record<string, CanvasCard>>;
  imageModels: WorkspaceModelOption[];
  isCanvasReady?: boolean;
  videoModels: WorkspaceModelOption[];
  promotePendingUploadsForDraft: (draftId: string) => Promise<void>;
  createGenerationOutput: (params: {
    draftCard: CanvasDraftCard;
    name: string;
    suppressFocus?: boolean;
  }) => string | null;
  updateGenerationOutput: (
    outputCardId: string,
    patch: Partial<CanvasOutputCard>
  ) => void;
  completeGenerationOutput: (params: {
    outputCardId: string;
    draftCard: CanvasDraftCard;
    url: string;
    name: string;
    sourceGenerationId?: string | null;
    suppressFocus?: boolean;
  }) => string | null;
  setErrorMessage: (message: string | null) => void;
  setStatusMessage: (message: string) => void;
  updateDraftCard: (
    draftId: string,
    updater:
      | Partial<CanvasDraftCard>
      | ((current: CanvasDraftCard) => CanvasDraftCard)
  ) => void;
  onCreditBalanceMayChange?: () => void;
}) {
  const statusLabels = useMemo(
    () => ({
      idle: studioT('status.labels.idle'),
      pending: studioT('status.labels.pending'),
      processing: studioT('status.labels.processing'),
      succeeded: studioT('status.labels.succeeded'),
      failed: studioT('status.labels.failed'),
    }),
    [studioT]
  );

  const runtimeMessages = useMemo(
    () => ({
      missingVideoUrl: studioT('messages.missingVideoUrl'),
      readVideoDurationFailed: studioT('messages.readVideoDurationFailed'),
      videoMetadataLoadFailed: studioT('messages.videoMetadataLoadFailed'),
    }),
    [studioT]
  );

  const effectIds = useMemo(() => {
    return [
      ...new Set([...imageModels, ...videoModels].map((item) => item.effectId)),
    ];
  }, [imageModels, videoModels]);
  const { data: effectMetadata } = useEffectMetadata(effectIds, {
    enabled: isCanvasReady,
  });
  const metadataMap = useMemo(
    () => buildEffectMetadataMap(effectMetadata ?? {}),
    [effectMetadata]
  );

  const buildEffectInput = useCallback(
    (draftCard: CanvasDraftCard) =>
      buildGenerationEffectInput({
        draftCard,
        canvasCards: canvasCardsRef.current,
        imageModels,
        videoModels,
        metadataMap,
        runtimeMessages,
        translate: studioT,
        notify: (message) => {
          toast(message);
        },
      }),
    [
      canvasCardsRef,
      imageModels,
      metadataMap,
      runtimeMessages,
      studioT,
      videoModels,
    ]
  );

  const pollEffectUntilComplete = useCallback(
    ({
      wmTaskId,
      effectId,
      onStatus,
    }: {
      wmTaskId: string;
      effectId: number;
      onStatus?: (status: StudioJobStatus, message: string) => void;
    }) =>
      pollGenerationUntilComplete({
        wmTaskId,
        effectId,
        onStatus,
        statusLabels,
        translate: studioT,
      }),
    [statusLabels, studioT]
  );

  const runGenerateDraft = useCallback(
    async (draftId: string, options?: GenerateDraftOptions) => {
      try {
        setErrorMessage(null);
        setStatusMessage(studioT('messages.preparingAssets'));
        await promotePendingUploadsForDraft(draftId);
      } catch (error) {
        const message = getDraftUploadFailureMessage({
          error,
          fallbackMessage: studioT('messages.uploadFailed'),
        });
        updateDraftCard(draftId, {
          status: 'failed',
          error: message,
        });
        setErrorMessage(message);
        setStatusMessage(message);
        toast.error(message);
        return false;
      }

      const completed = await runDraftGeneration({
        draftId,
        projectId,
        getCurrentCard: (nextDraftId) => canvasCardsRef.current[nextDraftId],
        buildEffectInput: async (draftCard) => {
          const result = await buildEffectInput(draftCard);
          if (draftCard.workflowTemplateId) {
            result.input.wmWorkflowTemplateId = draftCard.workflowTemplateId;
          }
          if (options?.batchIndex && options.batchTotal) {
            result.input.wmBatchIndex = options.batchIndex;
            result.input.wmBatchTotal = options.batchTotal;
          }
          return result;
        },
        updateDraftCard,
        createGenerationOutput,
        updateGenerationOutput,
        completeGenerationOutput,
        suppressResultFocus: options?.suppressResultFocus,
        setStatusMessage,
        setErrorMessage,
        getStatusLabel: (status) => getJobStatusLabel(status, statusLabels),
        translate: studioT,
        notifySuccess: (message) => {
          if (options?.suppressSuccessToast) {
            return;
          }

          toast.success(message);
        },
        notifyError: (message) => {
          toast.error(message);
        },
        pollEffectUntilCompleteImpl: pollEffectUntilComplete,
      });
      onCreditBalanceMayChange?.();
      return completed;
    },
    [
      buildEffectInput,
      canvasCardsRef,
      onCreditBalanceMayChange,
      pollEffectUntilComplete,
      projectId,
      promotePendingUploadsForDraft,
      createGenerationOutput,
      updateGenerationOutput,
      completeGenerationOutput,
      statusLabels,
      studioT,
      updateDraftCard,
    ]
  );

  const handleGenerateDraft = useCallback(
    (draftId: string) => {
      void runGenerateDraft(draftId);
    },
    [runGenerateDraft]
  );

  const resumedRunIdsRef = useRef<Set<string>>(new Set());

  /**
   * Re-attach polling to generations that were still pending/processing when
   * the page was last closed. Their task ids are persisted on the output
   * cards (sourceGenerationId), so results land back on the canvas.
   */
  const resumeInFlightGenerations = useCallback(() => {
    const inFlightOutputs = Object.values(canvasCardsRef.current).filter(
      (card): card is CanvasOutputCard =>
        isCanvasOutputCard(card) &&
        (card.status === 'pending' || card.status === 'processing') &&
        Boolean(card.sourceGenerationId) &&
        !resumedRunIdsRef.current.has(card.generationRunId ?? card.id)
    );

    for (const outputCard of inFlightOutputs) {
      const draftCard = canvasCardsRef.current[outputCard.sourceConfigCardId];
      if (!isCanvasDraftCard(draftCard)) {
        continue;
      }

      const models =
        outputCard.generationSnapshot.type === 'image'
          ? imageModels
          : videoModels;
      const model = getSelectableModel(
        models,
        outputCard.generationSnapshot.modelId
      );
      if (!model) {
        continue;
      }

      resumedRunIdsRef.current.add(
        outputCard.generationRunId ?? outputCard.id
      );

      if (
        draftCard.status !== 'pending' &&
        draftCard.status !== 'processing'
      ) {
        updateDraftCard(draftCard.id, {
          status: outputCard.status,
          error: null,
        });
      }

      void (async () => {
        const wmTaskId = outputCard.sourceGenerationId as string;
        try {
          const output = await pollEffectUntilComplete({
            wmTaskId,
            effectId: model.effectId,
            onStatus: (status, message) => {
              updateGenerationOutput(outputCard.id, { status });
              const latestDraft = canvasCardsRef.current[draftCard.id];
              if (isCanvasDraftCard(latestDraft)) {
                updateDraftCard(latestDraft.id, { status });
              }
              setStatusMessage(message);
            },
          });

          const resolvedMedia = resolveOutputMedia(output);
          if (!resolvedMedia.resultUrl) {
            throw new Error(studioT('messages.generationFailed'));
          }

          const latestDraft = canvasCardsRef.current[draftCard.id];
          if (!isCanvasDraftCard(latestDraft)) {
            return;
          }

          completeGenerationOutput({
            outputCardId: outputCard.id,
            draftCard: latestDraft,
            url: resolvedMedia.resultUrl,
            name: outputCard.name,
            sourceGenerationId: wmTaskId,
            suppressFocus: true,
          });
          updateDraftCard(latestDraft.id, {
            status: 'idle',
            error: null,
          });
          onCreditBalanceMayChange?.();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : studioT('messages.generationFailed');
          updateGenerationOutput(outputCard.id, {
            status: 'failed',
            error: message,
          });
          const latestDraft = canvasCardsRef.current[draftCard.id];
          if (
            isCanvasDraftCard(latestDraft) &&
            latestDraft.status !== 'pending' &&
            latestDraft.status !== 'processing'
          ) {
            updateDraftCard(latestDraft.id, {
              status: 'idle',
              error: null,
            });
          }
        }
      })();
    }
  }, [
    canvasCardsRef,
    completeGenerationOutput,
    imageModels,
    onCreditBalanceMayChange,
    pollEffectUntilComplete,
    setStatusMessage,
    studioT,
    updateDraftCard,
    updateGenerationOutput,
    videoModels,
  ]);

  return {
    handleGenerateDraft,
    metadataMap,
    resumeInFlightGenerations,
    runGenerateDraft,
  };
}
