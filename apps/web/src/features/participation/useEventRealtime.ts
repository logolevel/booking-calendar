import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../../shared/realtime/socket';

// Subscribes to live participant updates for one event and refetches on change.
export function useEventRealtime(eventId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!eventId) {
      return;
    }
    const socket = getSocket();

    const subscribe = (): void => {
      socket.emit('subscribe', eventId);
    };
    const onUpdate = (payload: { eventId: string }): void => {
      if (payload.eventId !== eventId) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: ['participants', eventId],
      });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    };

    socket.on('connect', subscribe);
    socket.on('event:update', onUpdate);
    if (socket.connected) {
      subscribe();
    }

    return () => {
      socket.emit('unsubscribe', eventId);
      socket.off('connect', subscribe);
      socket.off('event:update', onUpdate);
    };
  }, [eventId, queryClient]);
}
