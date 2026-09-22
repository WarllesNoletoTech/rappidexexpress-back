import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { addHours } from 'date-fns';
import { PostgresCompatRepository } from '../database/postgres-compat.repository';
import { DeliveryEntity, UserEntity } from '../database/entities';
import { DeliveryService } from '../delivery/delivery.service';
import { DeliveryResult } from '../delivery/dto';
import {
  PaymentType,
  StatusDelivery,
  UserType,
} from '../shared/constants/enums.constants';
import { MenuFlowDeliveryDto } from './menuflow-integration.dto';
import { MenuFlowStatusSyncService } from './menuflow-status-sync.service';

@Injectable()
export class MenuFlowIntegrationService {
  private readonly logger = new Logger(MenuFlowIntegrationService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: PostgresCompatRepository<UserEntity>,
    @InjectRepository(DeliveryEntity)
    private readonly deliveries: PostgresCompatRepository<DeliveryEntity>,
    @Inject(forwardRef(() => DeliveryService))
    private readonly deliveryService: DeliveryService,
    private readonly statusSync: MenuFlowStatusSyncService,
  ) {}

  async createDelivery(data: MenuFlowDeliveryDto) {
    const existing = await this.deliveries.findOneBy({
      menuFlowOrderId: data.orderId,
    } as any);
    if (existing) {
      return {
        accepted: true,
        created: false,
        delivery: DeliveryResult.fromEntity(existing),
      };
    }

    const establishment = await this.users.findOne({
      where: { menuFlowCompanyId: data.restaurantId } as any,
    });

    if (!establishment) {
      return {
        accepted: false,
        created: false,
        reason: 'NOT_LINKED',
        message: 'Nenhuma empresa Rappidex está vinculada a este ID do Menu Flow.',
      };
    }

    if (!establishment.menuFlowEnabled) {
      return {
        accepted: false,
        created: false,
        reason: 'INTEGRATION_DISABLED',
        message: 'A integração Menu Flow está desativada para esta empresa na Rappidex.',
      };
    }

    if (!establishment.isActive || establishment.blocked) {
      return {
        accepted: false,
        created: false,
        reason: 'COMPANY_INACTIVE',
        message: 'A empresa vinculada está inativa ou bloqueada na Rappidex.',
      };
    }

    if (
      ![UserType.SHOPKEEPER, UserType.SHOPKEEPERADMIN].includes(
        establishment.type,
      )
    ) {
      return {
        accepted: false,
        created: false,
        reason: 'INVALID_COMPANY',
        message: 'O ID Menu Flow foi vinculado a um usuário que não é estabelecimento.',
      };
    }

    if (!establishment.cityId) {
      return {
        accepted: false,
        created: false,
        reason: 'COMPANY_WITHOUT_CITY',
        message: 'A empresa Rappidex vinculada precisa ter uma cidade configurada.',
      };
    }

    const address = data.address || {};
    const streetLine = [address.street, address.number].filter(Boolean).join(', ');
    const fullAddress = [
      streetLine,
      address.complement ? `Complemento: ${address.complement}` : null,
      address.neighborhood ? `Bairro: ${address.neighborhood}` : null,
      [address.city, address.state].filter(Boolean).join(' - ') || null,
      address.zipCode ? `CEP ${address.zipCode}` : null,
      address.reference ? `Referência: ${address.reference}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const itemObservation = (data.items || [])
      .filter((item) => item.observation)
      .map((item) => `${item.productName}: ${item.observation}`)
      .join(' | ');

    const observation = [
      itemObservation || null,
      data.needsChange && data.changeForCents
        ? `Troco para R$ ${(data.changeForCents / 100).toFixed(2).replace('.', ',')}`
        : data.paymentMethod === 'CASH'
          ? 'Troco: não precisa'
          : null,
    ]
      .filter(Boolean)
      .join(' | ');

    try {
      const created = await this.deliveryService.createDelivery(
        {
          clientName: data.customerName,
          clientPhone: this.normalizeClientPhone(data.customerPhone),
          clientLocation: fullAddress || streetLine || undefined,
          clientAddress: fullAddress || streetLine || undefined,
          addressComplement: address.complement || undefined,
          addressReference: address.reference || undefined,
          addressNeighborhood: address.neighborhood || undefined,
          addressCity: address.city || undefined,
          addressState: address.state || undefined,
          addressZipCode: address.zipCode || undefined,
          addressLatitude: this.optionalNumber(address.latitude),
          addressLongitude: this.optionalNumber(address.longitude),
          addressMapsUrl: address.mapUrl || address.mapsUrl || undefined,
          status: StatusDelivery.AWAITING_RELEASE,
          value: (data.totalCents / 100).toFixed(2),
          payment: this.mapPayment(data.paymentMethod),
          soda: 'NÃO',
          observation,
        },
        {
          id: establishment.id,
          phone: establishment.phone || '',
          user: establishment.user,
          type: establishment.type,
          permission: establishment.permission,
          cityId: establishment.cityId,
        },
        {
          skipCreditConsumption: true,
          menuFlow: {
            orderId: data.orderId,
            orderNumber: data.orderNumber,
            companyId: data.restaurantId,
            restaurantName: data.restaurantName,
            subtotalCents: data.subtotalCents,
            deliveryFeeCents: data.deliveryFeeCents,
            serviceFeeCents: data.customerServiceFeeCents,
            discountCents: data.discountCents,
            totalCents: data.totalCents,
            paymentMethod: data.paymentMethod,
            needsChange: data.needsChange,
            changeForCents: data.changeForCents,
            expectedChangeCents: data.expectedChangeCents,
            items: data.items,
          },
        },
      );

      this.logger.log(
        `Menu Flow -> Rappidex criado orderId=${data.orderId} orderNumber=${data.orderNumber} deliveryId=${created.id} companyId=${establishment.id} status=${StatusDelivery.AWAITING_RELEASE}`,
      );

      return { accepted: true, created: true, delivery: created };
    } catch (error: any) {
      if (error?.code === 11000 || error?.code === '23505' || error?.codeName === 'DuplicateKey') {
        const duplicated = await this.deliveries.findOneBy({
          menuFlowOrderId: data.orderId,
        } as any);
        if (duplicated) {
          return {
            accepted: true,
            created: false,
            delivery: DeliveryResult.fromEntity(duplicated),
          };
        }
      }
      throw error;
    }
  }

  async releaseDelivery(menuFlowOrderId: string) {
    const delivery = await this.deliveries.findOneBy({
      menuFlowOrderId,
    } as any);
    if (!delivery) {
      return { found: false, released: false };
    }

    if (delivery.status === StatusDelivery.CANCELED) {
      return {
        found: true,
        released: false,
        cancelled: true,
        delivery: DeliveryResult.fromEntity(delivery),
      };
    }
    if (delivery.status === StatusDelivery.FINISHED) {
      return {
        found: true,
        released: false,
        finished: true,
        delivery: DeliveryResult.fromEntity(delivery),
      };
    }
    if (delivery.status !== StatusDelivery.AWAITING_RELEASE) {
      return {
        found: true,
        released: true,
        alreadyReleased: true,
        delivery: DeliveryResult.fromEntity(delivery),
      };
    }

    const establishmentId = delivery.establishment?.id;
    if (!establishmentId) {
      throw new Error('A entrega Menu Flow não possui estabelecimento Rappidex vinculado.');
    }
    const establishment = await this.users.findOneBy({ id: establishmentId } as any);
    if (!establishment) {
      throw new Error('Estabelecimento Rappidex da entrega não foi encontrado.');
    }

    const released = await this.deliveryService.releaseDelivery(
      delivery.id,
      {
        id: establishment.id,
        phone: establishment.phone || '',
        user: establishment.user,
        type: establishment.type,
        permission: establishment.permission,
        cityId: establishment.cityId,
      },
      undefined,
    );

    this.logger.log(
      `Menu Flow -> Rappidex liberado orderId=${menuFlowOrderId} deliveryId=${delivery.id} status=${released.status}`,
    );

    return {
      found: true,
      released: true,
      delivery: released,
    };
  }

  async cancelDelivery(menuFlowOrderId: string) {
    const delivery = await this.deliveries.findOneBy({
      menuFlowOrderId,
    } as any);
    if (!delivery) return { found: false, cancelled: false };
    if (delivery.status === StatusDelivery.CANCELED) {
      return { found: true, cancelled: true, deliveryId: delivery.id };
    }
    if (delivery.status === StatusDelivery.FINISHED) {
      return {
        found: true,
        cancelled: false,
        finished: true,
        deliveryId: delivery.id,
      };
    }

    const assignedStatuses = [
      StatusDelivery.ONCOURSE,
      StatusDelivery.ARRIVED_AT_STORE,
      StatusDelivery.COLLECTED,
      StatusDelivery.ARRIVED_AT_DESTINATION,
      StatusDelivery.AWAITING_CODE,
    ];
    if (assignedStatuses.includes(delivery.status)) {
      return {
        found: true,
        cancelled: false,
        locked: true,
        status: delivery.status,
        deliveryId: delivery.id,
      };
    }

    const now = addHours(new Date(), -3);
    const updated = await this.deliveries.save({
      ...delivery,
      status: StatusDelivery.CANCELED,
      isActive: false,
      finishedAt: now,
      updatedAt: now,
      menuFlowSyncPending: true,
    });
    this.statusSync.queueDelivery(updated.id);
    this.logger.log(
      `Menu Flow -> Rappidex cancelado orderId=${menuFlowOrderId} deliveryId=${updated.id}`,
    );
    return { found: true, cancelled: true, deliveryId: updated.id };
  }

  private normalizeClientPhone(value: string) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      digits = digits.slice(2);
    }
    return digits;
  }

  private mapPayment(method: string): PaymentType {
    if (method === 'PIX') return PaymentType.PIX;
    if (method === 'CASH') return PaymentType.DINHEIRO;
    return PaymentType.CARTAO;
  }

  private optionalNumber(value?: string) {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
