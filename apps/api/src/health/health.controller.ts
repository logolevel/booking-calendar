import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@tg-calendar/shared-types';

@Controller('api')
export class HealthController {
  @Get('health')
  health(): HealthResponse {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
