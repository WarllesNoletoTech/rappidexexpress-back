import { IfoodEventService } from './ifood-event.service';

describe('IfoodEventService - confirmação de entrega', () => {
  const createService = (events: any[]) => {
    const repository = {
      find: jest.fn().mockResolvedValue(events),
    };
    return {
      service: new IfoodEventService(repository as any),
      repository,
    };
  };

  it('reconhece fullCode DELIVERY_DROP_CODE_REQUESTED', async () => {
    const { service, repository } = createService([
      { fullCode: 'DELIVERY_DROP_CODE_REQUESTED', code: 'DDCR' },
    ]);
    await expect(service.hasDeliveryDropCodeRequested('order-1')).resolves.toBe(true);
    expect(repository.find).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
    });
  });

  it('reconhece o código curto DDCR quando fullCode não foi persistido', async () => {
    const { service } = createService([{ code: 'DDCR', fullCode: '' }]);
    await expect(service.hasDeliveryDropCodeRequested('order-2')).resolves.toBe(true);
  });

  it('não confunde outros eventos com autorização de código', async () => {
    const { service } = createService([{ code: 'CON', fullCode: 'CONCLUDED' }]);
    await expect(service.hasDeliveryDropCodeRequested('order-3')).resolves.toBe(false);
  });
});
