import { IfoodWebhookController } from './ifood-webhook.controller';

describe('IfoodWebhookController', () => {
  it('deve aceitar webhook normal e enfileirar processamento assíncrono', () => {
    const ifoodWebhookService = { enqueueIncomingEvents: jest.fn() } as any;
    const controller = new IfoodWebhookController(ifoodWebhookService);
    const payload = [{ id: 'evt-1', orderId: 'ord-1' }];

    const response = controller.receiveWebhook(payload);

    expect(response).toBeUndefined();
    expect(ifoodWebhookService.enqueueIncomingEvents).toHaveBeenCalledWith(
      payload,
    );
  });

  it('deve responder KEEPALIVE sem enfileirar na fila normal', () => {
    const ifoodWebhookService = { enqueueIncomingEvents: jest.fn() } as any;
    const controller = new IfoodWebhookController(ifoodWebhookService);

    const response = controller.receiveWebhook([
      { id: 'keep-1', code: 'KEEPALIVE', merchantId: 'merchant-1' },
    ]);

    expect(response).toEqual(['merchant-1']);
    expect(ifoodWebhookService.enqueueIncomingEvents).not.toHaveBeenCalled();
  });
});
