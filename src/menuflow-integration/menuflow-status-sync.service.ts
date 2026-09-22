import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PostgresCompatRepository } from '../database/postgres-compat.repository';
import { DeliveryEntity } from '../database/entities';
import { StatusDelivery } from '../shared/constants/enums.constants';

const MENU_FLOW_STATUS_LABELS: Record<StatusDelivery, string> = {
  [StatusDelivery.AWAITING_RELEASE]: 'Aguardando liberação',
  [StatusDelivery.PENDING]: 'Aguardando motoboy',
  [StatusDelivery.ONCOURSE]: 'Motoboy indo até o estabelecimento',
  [StatusDelivery.ARRIVED_AT_STORE]: 'Motoboy chegou ao estabelecimento',
  [StatusDelivery.COLLECTED]: 'Motoboy a caminho do cliente',
  [StatusDelivery.ARRIVED_AT_DESTINATION]: 'Motoboy chegou ao destino',
  [StatusDelivery.AWAITING_CODE]: 'Aguardando código de entrega',
  [StatusDelivery.FINISHED]: 'Entrega concluída',
  [StatusDelivery.CANCELED]: 'Entrega cancelada',
};

@Injectable()
export class MenuFlowStatusSyncService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MenuFlowStatusSyncService.name);
  private retryTimer?: NodeJS.Timeout;
  private retryRunning = false;
  private syncQueue: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(DeliveryEntity)
    private readonly deliveries: PostgresCompatRepository<DeliveryEntity>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.retryTimer = setInterval(() => void this.retryPending(), 60_000);
    this.retryTimer.unref?.();
    setTimeout(() => void this.retryPending(), 7_500).unref?.();
  }

  onModuleDestroy() {
    if (this.retryTimer) clearInterval(this.retryTimer);
  }

  queueDelivery(deliveryId: string) {
    void this.enqueueSync(() => this.markPendingAndSync(deliveryId)).catch(
      (error) => {
        this.logger.warn(
          `Rappidex -> Menu Flow falhou deliveryId=${deliveryId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    );
  }

  private enqueueSync(operation: () => Promise<void>): Promise<void> {
    const queued = this.syncQueue.then(operation);
    this.syncQueue = queued.catch(() => undefined);
    return queued;
  }

  private async markPendingAndSync(deliveryId: string) {
    await this.deliveries.updateOne(
      { id: deliveryId } as any,
      {
        $set: {
          menuFlowSyncPending: true,
          menuFlowSyncError: '',
        },
      } as any,
    );
    await this.syncDelivery(deliveryId);
  }

  private async syncDelivery(deliveryId: string) {
    const delivery = await this.deliveries.findOne({
      where: { id: deliveryId } as any,
      relations: { motoboy: true, establishment: true },
    });
    if (
      !delivery ||
      delivery.source !== 'MENU_FLOW' ||
      !delivery.menuFlowOrderId
    ) {
      return;
    }

    const updatedAt = delivery.updatedAt || new Date();
    const eventId = `${delivery.id}:${delivery.status}:${new Date(updatedAt).getTime()}`;
    const statusLabel =
      MENU_FLOW_STATUS_LABELS[delivery.status] || String(delivery.status);

    try {
      await this.request('/integrations/rappidex/status', {
        method: 'POST',
        body: JSON.stringify({
          orderId: delivery.menuFlowOrderId,
          deliveryId: delivery.id,
          status: delivery.status,
          statusLabel,
          eventId,
          updatedAt: new Date(updatedAt).toISOString(),
          motoboyName: delivery.motoboy?.name || undefined,
          motoboyPhone: delivery.motoboy?.phone || undefined,
        }),
      });

      await this.deliveries.updateOne(
        { id: delivery.id } as any,
        {
          $set: {
            menuFlowSyncPending: false,
            menuFlowLastSyncAt: new Date(),
            menuFlowLastSyncedStatus: delivery.status,
            menuFlowSyncError: '',
          },
        } as any,
      );

      this.logger.log(
        `Rappidex -> Menu Flow deliveryId=${delivery.id} orderId=${delivery.menuFlowOrderId} status=${delivery.status} label="${statusLabel}"`,
      );
    } catch (error) {
      await this.deliveries.updateOne(
        { id: delivery.id } as any,
        {
          $set: {
            menuFlowSyncPending: true,
            menuFlowSyncError: (error instanceof Error
              ? error.message
              : String(error)
            ).slice(0, 1000),
          },
        } as any,
      );
      throw error;
    }
  }

  private async retryPending() {
    if (this.retryRunning) {
      this.logger.warn('Fila Menu Flow: ciclo anterior ainda em execução.');
      return;
    }
    this.retryRunning = true;
    try {
      const pending = await this.deliveries.find({
        where: {
          source: 'MENU_FLOW',
          menuFlowSyncPending: true,
        } as any,
        take: 25,
      });
      // Sequencial por intenção: com pool de 5, o retry nunca deve tomar todas
      // as conexões das requisições HTTP.
      for (const delivery of pending) {
        try {
          await this.enqueueSync(() => this.syncDelivery(delivery.id));
        } catch (error) {
          this.logger.warn(
            `Fila Menu Flow deliveryId=${delivery.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Fila de status Menu Flow: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.retryRunning = false;
    }
  }

  private async request(path: string, init: RequestInit) {
    const base = String(this.config.get<string>('MENUFLOW_API_URL') || '')
      .trim()
      .replace(/\/+$/, '');
    const secret = String(
      this.config.get<string>('MENUFLOW_INTEGRATION_SECRET') || '',
    ).trim();
    if (!base || !secret) {
      throw new Error(
        'MENUFLOW_API_URL e MENUFLOW_INTEGRATION_SECRET precisam estar configurados no backend da Rappidex.',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${base}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${secret}`,
          ...(init.headers || {}),
        },
      });
      const text = await response.text();
      if (!response.ok) {
        let detail: any = text;
        try {
          detail = text ? JSON.parse(text) : null;
        } catch {
          // mantém o corpo textual
        }
        throw new Error(
          `Menu Flow respondeu ${response.status}: ${detail?.message || detail?.error || text || 'erro sem corpo'}`,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
