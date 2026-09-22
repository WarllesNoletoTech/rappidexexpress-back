import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';
import { PostgresPoolMonitorService } from './database/postgres-pool-monitor.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: DataSource, useValue: { query: jest.fn() } },
        {
          provide: PostgresPoolMonitorService,
          useValue: { warnIfAbnormal: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "API - Delivery Manager"', () => {
      expect(appController.getInitialRoute()).toBe('API - Delivery Manager');
    });
  });
});
