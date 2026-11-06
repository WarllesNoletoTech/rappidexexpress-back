import { UnauthorizedException } from '@nestjs/common';
import { IfoodWebhookController } from './ifood-webhook.controller';

describe('IfoodWebhookController', () => {
  const build = (accepted: boolean) => {
    const webhook = { enqueueIncomingEvents: jest.fn() } as any;
    const auth = { verifyWebhookSignature: jest.fn().mockReturnValue(accepted) } as any;
    return { controller: new IfoodWebhookController(webhook, auth), webhook, auth };
  };

  it('aceita corpo bruto com assinatura válida e enfileira evento', () => {
    const { controller, webhook, auth } = build(true);
    const payload = [{ id: 'evt-1', orderId: 'ord-1' }];
    const rawBody = Buffer.from(JSON.stringify(payload));
    const response = controller.receiveWebhook(payload, { rawBody } as any, 'assinatura');
    expect(response).toEqual({ success: true, processedAsync: true, received: 1 });
    expect(auth.verifyWebhookSignature).toHaveBeenCalledWith(rawBody, 'assinatura');
    expect(webhook.enqueueIncomingEvents).toHaveBeenCalledWith(payload);
  });

  it('recusa webhook com assinatura inválida sem enfileirar', () => {
    const { controller, webhook } = build(false);
    expect(() => controller.receiveWebhook({ id: 'fake' }, { rawBody: Buffer.from('{}') } as any, 'invalida'))
      .toThrow(UnauthorizedException);
    expect(webhook.enqueueIncomingEvents).not.toHaveBeenCalled();
  });
});
