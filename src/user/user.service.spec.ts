import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { IfoodImportService } from '../ifood/ifood-import.service';
import { UserType } from '../shared/constants/enums.constants';
import { ObjectId } from 'mongodb';
import { CityEntity, DeliveryEntity, LogEntity, UserEntity } from '../database/entities';

describe('UserService', () => {
  let service: UserService;
  let userRepository: any;
  let deliveryRepository: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOneBy: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DeliveryEntity),
          useValue: {
            find: jest.fn(),
            findOneBy: jest.fn(),
            save: jest.fn(),
            aggregate: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LogEntity),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CityEntity),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
        { provide: IfoodImportService, useValue: {} },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(getRepositoryToken(UserEntity));
    deliveryRepository = module.get(getRepositoryToken(DeliveryEntity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('mostra todos os motoboys da cidade sem incluir os de outra cidade', async () => {
    const cityId = 'cidade-a';
    userRepository.findOneBy.mockResolvedValue({ id: 'admin', type: UserType.ADMIN, cityId });
    userRepository.find.mockResolvedValue([
      { id: 'moto-1', name: 'Ana', type: UserType.MOTOBOY, cityId },
      { id: 'moto-2', name: 'Bruno', type: UserType.MOTOBOY, cityId },
      { id: 'moto-outra', name: 'Celia', type: UserType.MOTOBOY, cityId: 'cidade-b' },
    ]);
    deliveryRepository.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    deliveryRepository.find.mockResolvedValue([]);

    const result = await service.findMotoboys({ id: 'admin', type: UserType.ADMIN } as any);
    expect(result.map((m) => m.id)).toEqual(['moto-1', 'moto-2']);
    expect(userRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { type: UserType.MOTOBOY, cityId },
    }));
  });

  it('inclui cadastros legados com cityId ObjectId no seletor', async () => {
    const cityId = new ObjectId();
    userRepository.findOneBy.mockResolvedValue({
      id: 'admin', type: UserType.ADMIN, cityId: cityId.toHexString(),
    });
    userRepository.find.mockResolvedValue([{
      id: 'moto-legado', name: 'Legado', type: UserType.MOTOBOY, cityId,
    }]);
    deliveryRepository.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    deliveryRepository.find.mockResolvedValue([]);

    const result = await service.findMotoboys({ id: 'admin', type: UserType.ADMIN } as any);
    expect(result.map((m) => m.id)).toEqual(['moto-legado']);
    const [{ where }] = userRepository.find.mock.calls[0];
    expect(where.cityId.$in).toHaveLength(2);
    expect(where.cityId.$in[0]).toBe(cityId.toHexString());
    expect(where.cityId.$in[1].toHexString()).toBe(cityId.toHexString());
  });

  it('não deixa consultas de contagem/última entrega esconderem motoboys', async () => {
    const cityId = 'cidade-a';
    userRepository.findOneBy.mockResolvedValue({ id: 'admin', type: UserType.ADMIN, cityId });
    userRepository.find.mockResolvedValue([
      { id: 'moto-1', name: 'Ana', type: UserType.MOTOBOY, cityId },
      { id: 'moto-2', name: 'Bruno', type: UserType.MOTOBOY, cityId },
    ]);
    deliveryRepository.aggregate.mockReturnValue({ toArray: jest.fn().mockRejectedValue(new Error('agregação indisponível')) });
    deliveryRepository.count.mockRejectedValue(new Error('contagem indisponível'));

    const result = await service.findMotoboys({ id: 'admin', type: UserType.ADMIN } as any);
    expect(result.map((m) => m.id)).toEqual(['moto-1', 'moto-2']);
    expect(result.every((m) => m.name.includes('sem ultima entrega'))).toBe(true);
  });
});
