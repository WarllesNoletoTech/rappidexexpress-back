import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, finalize, throwError } from 'rxjs';
import { PostgresPoolMonitorService } from './postgres-pool-monitor.service';

@Injectable()
export class PostgresPoolInterceptor implements NestInterceptor {
  constructor(private readonly poolMonitor: PostgresPoolMonitorService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startedAt = Date.now();
    const request = context.switchToHttp().getRequest();
    const operation = `${request?.method || 'HTTP'} ${request?.route?.path || request?.path || 'unknown'}`;
    let requestError: unknown;

    return next.handle().pipe(
      catchError((error) => {
        requestError = error;
        return throwError(() => error);
      }),
      finalize(() => {
        this.poolMonitor.warnIfAbnormal(
          operation,
          Date.now() - startedAt,
          requestError,
        );
      }),
    );
  }
}
