import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type PostgresPoolSnapshot = {
  total: number;
  idle: number;
  busy: number;
  waiting: number;
};

@Injectable()
export class PostgresPoolMonitorService {
  private readonly logger = new Logger(PostgresPoolMonitorService.name);
  private lastWarningAt = 0;

  constructor(private readonly dataSource: DataSource) {}

  snapshot(): PostgresPoolSnapshot | null {
    const driver = this.dataSource.driver as any;
    const pool = driver?.master;
    if (!pool) return null;

    const total = Number(pool.totalCount) || 0;
    const idle = Number(pool.idleCount) || 0;
    return {
      total,
      idle,
      busy: Math.max(0, total - idle),
      waiting: Number(pool.waitingCount) || 0,
    };
  }

  warnIfAbnormal(operation: string, durationMs: number, error?: unknown) {
    const pool = this.snapshot();
    const isSlow = durationMs >= 500;
    const isWaiting = Boolean(pool?.waiting);
    if (!error && !isSlow && !isWaiting) return;

    // Um dyno sob pressão pode terminar muitas requests ao mesmo tempo. Limitar
    // a uma amostra a cada 10s mantém o diagnóstico útil sem inundar o Heroku.
    const now = Date.now();
    if (!error && now - this.lastWarningAt < 10_000) return;
    this.lastWarningAt = now;

    const pgCode = (error as any)?.code || 'N/A';
    this.logger.warn(
      `postgres_pool_warning operation=${operation} durationMs=${durationMs} total=${pool?.total ?? 'N/A'} busy=${pool?.busy ?? 'N/A'} idle=${pool?.idle ?? 'N/A'} waiting=${pool?.waiting ?? 'N/A'} pgCode=${pgCode}`,
    );
  }
}
