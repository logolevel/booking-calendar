import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../../shared/realtime/socket';

// Subscribes the open calendar to list-level changes (event created / updated /
// deleted) and refetches the event list live, without a manual reload.
export function useCalendarRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const subscribe = (): void => {
      socket.emit('subscribe:calendar');
    };
    const onUpdate = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    };

    socket.on('connect', subscribe);
    socket.on('calendar:update', onUpdate);
    if (socket.connected) {
      subscribe();
    }

    return () => {
      socket.emit('unsubscribe:calendar');
      socket.off('connect', subscribe);
      socket.off('calendar:update', onUpdate);
    };
  }, [queryClient]);
}
