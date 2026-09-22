import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';
import { PostgresPoolMonitorService } from './database/postgres-pool-monitor.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
    private readonly poolMonitor: PostgresPoolMonitorService,
  ) {}

  @Get()
  getInitialRoute(): string {
    return this.appService.getInitialRoute();
  }

  @Get('health')
  async health() {
    const startedAt = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      const databaseResponseMs = Date.now() - startedAt;
      this.poolMonitor.warnIfAbnormal(
        'GET /health SELECT 1',
        databaseResponseMs,
      );
      return {
        status: 'ok',
        postgres: databaseResponseMs >= 500 ? 'slow' : 'ok',
        databaseResponseMs,
      };
    } catch (error) {
      const databaseResponseMs = Date.now() - startedAt;
      this.poolMonitor.warnIfAbnormal(
        'GET /health SELECT 1',
        databaseResponseMs,
        error,
      );
      return {
        status: 'degraded',
        postgres: 'unavailable',
        databaseResponseMs,
      };
    }
  }
}
