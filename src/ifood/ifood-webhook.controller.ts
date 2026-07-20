import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { IfoodWebhookService } from './ifood-webhook.service';

@Controller('ifood')
export class IfoodWebhookController {
  private readonly logger = new Logger(IfoodWebhookController.name);

  constructor(private readonly ifoodWebhookService: IfoodWebhookService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.ACCEPTED)
  receiveWebhook(@Body() body: any) {
    const events = this.extractEvents(body);
    const keepaliveEvents = events.filter((event) => this.isKeepalive(event));
    const normalEvents = events.filter((event) => !this.isKeepalive(event));

    if (normalEvents.length > 0) {
      this.ifoodWebhookService.enqueueIncomingEvents(normalEvents);
    }

    this.logger.log(
      `Webhook do iFood aceito. Eventos normais: ${normalEvents.length}. KEEPALIVE: ${keepaliveEvents.length}.`,
    );

    if (keepaliveEvents.length > 0 && normalEvents.length === 0) {
      const merchantIds = keepaliveEvents
        .map((event) => String(event?.merchantId || '').trim())
        .filter(Boolean);
      return merchantIds.length > 0 ? merchantIds : undefined;
    }

    return undefined;
  }

  private isKeepalive(event: any) {
    return (
      String(event?.fullCode || event?.code || '')
        .trim()
        .toUpperCase() === 'KEEPALIVE'
    );
  }

  private extractEvents(body: any) {
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.events)) return body.events;
    if (
      body &&
      typeof body === 'object' &&
      (body.id || body.code || body.fullCode)
    )
      return [body];
    return [];
  }
}
