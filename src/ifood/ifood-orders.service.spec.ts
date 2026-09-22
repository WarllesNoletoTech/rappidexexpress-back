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

  it('normaliza telefone do motoboy e exige 202 no assignDriver', async () => {
    const httpService = {
      request: jest.fn().mockResolvedValue({ status: 202, data: undefined }),
    };
    const service = new IfoodOrdersService(
      { getAccessToken: jest.fn().mockResolvedValue('token') } as any,
      httpService as any,
      { get: jest.fn().mockReturnValue(null) } as unknown as ConfigService,
      { findOne: jest.fn() } as any,
    );

    const result = await service.assignDriver(
      'order-1',
      { id: 'm1', name: 'João', phone: '(11) 99999-8888' } as any,
      'merchant-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        accepted: true,
        httpStatus: 202,
        action: 'assignDriver',
      }),
    );
    expect(httpService.request).toHaveBeenCalledWith(
      'logistics_assign_driver',
      expect.objectContaining({
        validateStatus: expect.any(Function),
        data: expect.objectContaining({ workerPhone: '5511999998888' }),
      }),
    );
  });

  it('identifica telefone inválido do motoboy sem chamar assignDriver', async () => {
    const httpService = { request: jest.fn() };
    const service = new IfoodOrdersService(
      { getAccessToken: jest.fn().mockResolvedValue('token') } as any,
      httpService as any,
      { get: jest.fn().mockReturnValue(null) } as unknown as ConfigService,
      { findOne: jest.fn() } as any,
    );

    await expect(
      service.assignDriver(
        'order-1',
        { id: 'm1', name: 'João', phone: '123' } as any,
        'merchant-1',
      ),
    ).rejects.toMatchObject({
      ifoodSyncContext: expect.objectContaining({
        action: 'assignDriver',
        httpStatus: 400,
      }),
    });
    expect(httpService.request).not.toHaveBeenCalled();
  });
});
