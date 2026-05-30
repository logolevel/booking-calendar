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

  emitEventUpdate(eventId: string): void {
    this.server?.to(room(eventId)).emit('event:update', { eventId });
  }
}
