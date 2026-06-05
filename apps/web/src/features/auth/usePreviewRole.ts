import { useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PreviewMode } from '@tg-calendar/shared-types';
import {
  getPreviewRole,
  setPreviewRole,
  subscribePreviewRole,
} from '../../shared/api/preview';

interface PreviewControls {
  preview: PreviewMode | null;
  setPreview: (role: PreviewMode | null) => void;
}

export function usePreviewRole(): PreviewControls {
  const preview = useSyncExternalStore(
    subscribePreviewRole,
    getPreviewRole,
    getPreviewRole,
  );
  const queryClient = useQueryClient();

  const setPreview = (role: PreviewMode | null): void => {
    setPreviewRole(role);
    void queryClient.invalidateQueries();
  };

  return { preview, setPreview };
}
