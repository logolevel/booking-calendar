import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { verifyInitData } from '../../auth/init-data';

function room(eventId: string): string {
  return `event:${eventId}`;
}

// Shared room every calendar viewer joins, used to announce list-level changes
// (event created / updated / deleted) so open calendars refresh live.
const CALENDAR_ROOM = 'calendar';

// Broadcasts participant-list changes to clients watching a given event.
// Each connection is authorized with verified Telegram initData.
@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly config: ConfigService) {}

  handleConnection(client: Socket): void {
    const auth = client.handshake.auth as { initData?: string } | undefined;
    const query = client.handshake.query as { initData?: string };
    const initData = auth?.initData ?? query.initData;
    const botToken = this.config.get<string>('BOT_TOKEN');

    if (!initData || !botToken || !verifyInitData(initData, botToken)) {
      this.logger.warn('Rejecting unauthorized socket connection');
      client.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe')
  onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() eventId: unknown,
  ): void {
    if (typeof eventId === 'string' && eventId) {
      void client.join(room(eventId));
    }
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() eventId: unknown,
  ): void {
    if (typeof eventId === 'string' && eventId) {
      void client.leave(room(eventId));
    }
  }

  @SubscribeMessage('subscribe:calendar')
  onSubscribeCalendar(@ConnectedSocket() client: Socket): void {
    void client.join(CALENDAR_ROOM);
  }

  @SubscribeMessage('unsubscribe:calendar')
  onUnsubscribeCalendar(@ConnectedSocket() client: Socket): void {
    void client.leave(CALENDAR_ROOM);
  }

  // Notify the event's own watchers (participant panel) and also refresh open
  // calendars, since a roster change affects the grid's fill indicator and may
  // auto-delete an empty event.
  emitEventUpdate(eventId: string): void {
    this.server?.to(room(eventId)).emit('event:update', { eventId });
    this.emitCalendarUpdate();
  }

  // Announce a list-level change (created/updated/deleted) to every open
  // calendar so they refetch the event list without a manual reload.
  emitCalendarUpdate(): void {
    this.server?.to(CALENDAR_ROOM).emit('calendar:update');
  }
}
