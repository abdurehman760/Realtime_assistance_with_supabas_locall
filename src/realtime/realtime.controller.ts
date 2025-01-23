import { Controller, Get } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { AI_CONFIG } from '../config/ai.config';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Get('session')
  async getSession() {
    return this.realtimeService.createSession();
  }

  @Get('config')
  getConfig() {
    return {
      keyExpirationTime: AI_CONFIG.realtime.keyExpirationTime
    };
  }
}
