import { ConfigService } from '@nestjs/config';
import { IfoodOrdersService } from './ifood-orders.service';
import { StatusDelivery } from '../shared/constants/enums.constants';

describe('IfoodOrdersService', () => {
  function makeService(userRepository: { findOne: jest.Mock }) {
    const service = new IfoodOrdersService(
      { getAccessToken: jest.fn() } as any,
      { request: jest.fn() } as any,
      { get: jest.fn().mockReturnValue(null) } as unknown as ConfigService,
      userRepository as any,
    );

    jest.spyOn(service, 'getOrderDetails').mockResolvedValue({
      id: 'ifood-order-1',
      displayId: '1234',
      merchant: { id: 'merchant-1', name: 'Loja iFood' },
      customer: { name: 'Cliente Teste', phone: { number: '11999998888' } },
      total: { orderAmount: 42.5 },
      payments: { methods: [{ type: 'ONLINE' }] },
      delivery: {
        deliveredBy: 'MERCHANT',
        deliveryAddress: {
          streetName: 'Rua A',
          streetNumber: '123',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
        },
      },
    });

    return service;
  }

  it('consulta status na API de Pedidos sem alterar o pedido', async () => {
    const getAccessToken = jest.fn().mockResolvedValue('token-test');
    const request = jest.fn().mockResolvedValue({ data: { status: 'CONCLUDED' } });
    const service = new IfoodOrdersService(
      { getAccessToken } as any,
      { request } as any,
      { get: jest.fn() } as any,
      {} as any,
    );

    await expect(service.getOrderState('order-123', 'merchant-456'))
      .resolves.toEqual({ status: 'CONCLUDED' });
    expect(getAccessToken).toHaveBeenCalledWith({ merchantId: 'merchant-456' });
    expect(request).toHaveBeenCalledWith('order_state', expect.objectContaining({
      method: 'GET',
      url: 'https://merchant-api.ifood.com.br/order/v1.0/orders/order-123',
    }));
  });

  it('creates iFood delivery as PENDENTE when company skips preparation time', async () => {
    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'shopkeeper-1' })
        .mockResolvedValueOnce({
          id: 'shopkeeper-1',
          isActive: true,
          useIfoodIntegration: true,
          ifoodWithoutPreparationTime: true,
        }),
    };
    const service = makeService(userRepository);

    const delivery = await service.buildCreateDeliveryDto('ifood-order-1');

    expect(delivery.status).toBe(StatusDelivery.PENDING);
    expect(delivery.establishmentId).toBe('shopkeeper-1');
  });

  it('keeps iFood delivery as AGUARDANDO_LIBERACAO when company uses preparation time', async () => {
    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'shopkeeper-1' })
        .mockResolvedValueOnce({
          id: 'shopkeeper-1',
          isActive: true,
          useIfoodIntegration: true,
          ifoodWithoutPreparationTime: false,
        }),
    };
    const service = makeService(userRepository);

    const delivery = await service.buildCreateDeliveryDto('ifood-order-1');

    expect(delivery.status).toBe(StatusDelivery.AWAITING_RELEASE);
    expect(delivery.establishmentId).toBe('shopkeeper-1');
  });
});
