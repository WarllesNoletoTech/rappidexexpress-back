import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { IfoodEventEntity } from '../database/entities';

@Injectable()
export class IfoodEventService implements OnModuleInit {
  private readonly logger = new Logger(IfoodEventService.name);

  constructor(
    @InjectRepository(IfoodEventEntity)
    private readonly ifoodEventRepository: MongoRepository<IfoodEventEntity>,
  ) {}

  async onModuleInit() {
    try {
      await this.ifoodEventRepository.createCollectionIndex(
        { acknowledged: 1 },
        {},
      );
      this.logger.log('Índice MongoDB garantido em ifood_event: acknowledged');
    } catch (error: any) {
      this.logger.warn(
        `Não foi possível garantir o índice acknowledged em ifood_event: ${error?.message || error}`,
      );
    }
  }

  async findByEventId(eventId: string) {
    return this.ifoodEventRepository.findOneBy({ eventId });
  }

  async findByOrderId(orderId: string) {
    const events = await this.ifoodEventRepository.find({
      where: { orderId } as any,
    });

    return Array.isArray(events) ? events : [];
  }

  async hasDeliveryDropCodeRequested(orderId: string) {
    const events = await this.findByOrderId(orderId);

    return events.some(
      (event) => event?.fullCode === 'DELIVERY_DROP_CODE_REQUESTED',
    );
  }

  async findRecentEligibleImportEvents(limit = 500) {
    const events = await this.ifoodEventRepository.find({
      where: {
        $or: [
          { code: 'CFM' },
          { code: 'CONFIRMED' },
          { code: 'DSP' },
          { code: 'RTP' },
          { fullCode: 'CONFIRMED' },
          { fullCode: 'DISPATCHED' },
          { fullCode: 'READY_TO_PICKUP' },
        ],
      } as any,
      order: { processedAt: 'DESC' },
      take: limit,
    });

    return Array.isArray(events) ? events : [];
  }

  async markAsProcessed(
    event: {
      id: string;
      orderId?: string;
      merchantId?: string;
      code?: string;
      fullCode?: string;
      salesChannel?: string;
      createdAt?: string;
    },
    acknowledged = false,
  ) {
    return this.ifoodEventRepository.save({
      eventId: event.id,
      orderId: event.orderId ?? '',
      merchantId: event.merchantId ?? '',
      code: event.code ?? '',
      fullCode: event.fullCode ?? '',
      salesChannel: event.salesChannel ?? '',
      createdAt: event.createdAt ?? '',
      processedAt: new Date(),
      acknowledged,
    });
  }

  async markAsAcknowledged(eventId: string) {
    await this.ifoodEventRepository.updateOne({ eventId }, {
      $set: {
        acknowledged: true,
      },
    } as any);
  }

  async findUnacknowledgedEventIds(limit = 500) {
    const events = await this.findUnacknowledgedEvents(limit);

    return events.map((event) => event.eventId);
  }

  async findUnacknowledgedEvents(limit = 500) {
    const events = await this.ifoodEventRepository.find({
      where: {
        acknowledged: false,
      } as any,
      take: limit,
      select: {
        eventId: true,
        merchantId: true,
      } as any,
    });

    return (Array.isArray(events) ? events : [])
      .map((event) => ({
        eventId: String(event?.eventId || '').trim(),
        merchantId: String((event as any)?.merchantId || '').trim(),
      }))
      .filter((event) => Boolean(event.eventId));
  }
}
