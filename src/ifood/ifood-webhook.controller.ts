import { Body, Controller, Headers, HttpCode, Logger, Post, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { IfoodAuthService } from './ifood-auth.service';
import { IfoodWebhookService } from './ifood-webhook.service';

@Controller('ifood')
export class IfoodWebhookController {
  private readonly logger = new Logger(IfoodWebhookController.name);

  constructor(
    private readonly ifoodWebhookService: IfoodWebhookService,
    private readonly ifoodAuthService: IfoodAuthService,
  ) {}

  @Post('webhook')
  @HttpCode(202)
  receiveWebhook(
    @Body() body: any,
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-ifood-signature') signature?: string,
  ) {
    if (!this.ifoodAuthService.verifyWebhookSignature(request?.rawBody, signature)) {
      throw new UnauthorizedException('Assinatura do webhook iFood inválida.');
    }

    const events = this.extractEvents(body);

    this.ifoodWebhookService.enqueueIncomingEvents(events);

    this.logger.log(
      `Webhook do iFood recebido com sucesso. Eventos no payload: ${events.length}.`,
    );

    return {
      success: true,
      processedAsync: true,
      received: events.length,
    };
  }

  private extractEvents(body: any) {
    if (Array.isArray(body)) {
      return body;
    }

    if (Array.isArray(body?.events)) {
      return body.events;
    }

    if (body && typeof body === 'object' && body.id) {
      return [body];
    }

    return [];
  }
}