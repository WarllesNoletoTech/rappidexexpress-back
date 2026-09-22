import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserService } from './user.service';
import {
  CityEntity,
  DeliveryEntity,
  LogEntity,
  UserEntity,
} from '../database/entities';
import { IfoodImportService } from '../ifood/ifood-import.service';

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
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        { provide: IfoodImportService, useValue: {} },
        {
          provide: getRepositoryToken(DeliveryEntity),
          useValue: {
            find: jest.fn(),
            findOneBy: jest.fn(),
            save: jest.fn(),
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
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(getRepositoryToken(UserEntity));
    deliveryRepository = module.get(getRepositoryToken(DeliveryEntity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('/user/motoboys não consulta o histórico de entregas', async () => {
    userRepository.find.mockResolvedValue([
      { id: 'motoboy-1', name: 'Ana', cityId: 'city-1' },
    ]);

    await expect(
      service.findMotoboys({
        id: 'admin-1',
        type: 'admin',
        permission: 'admin',
        cityId: 'city-1',
      } as any),
    ).resolves.toEqual([{ id: 'motoboy-1', name: 'Ana' }]);

    expect(deliveryRepository.find).not.toHaveBeenCalled();
    expect(deliveryRepository.findOneBy).not.toHaveBeenCalled();
  });
});
