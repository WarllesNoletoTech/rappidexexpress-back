import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
import {
  PaymentType,
  StatusDelivery,
} from '../../shared/constants/enums.constants';
import { UserEntity } from './user.entity';

@Entity()
@Index(['ifoodOrderId', 'ifoodMerchantId'], {
  unique: true,
  sparse: true,
})
@Index(['menuFlowOrderId'], {
  unique: true,
  sparse: true,
})
export class DeliveryEntity {
  @ObjectIdColumn()
  internalId: ObjectId;

  @Column('uuid')
  @Index({ unique: true })
  id: string;

  @Column()
  clientName: string;

  @Column()
  clientPhone: string;

  @Column({ nullable: true })
  clientLocation?: string;

  @Column({ nullable: true })
  clientAddress?: string;

  @Column({ nullable: true })
  addressComplement?: string;

  @Column({ nullable: true })
  addressReference?: string;

  @Column({ nullable: true })
  addressNeighborhood?: string;

  @Column({ nullable: true })
  addressCity?: string;

  @Column({ nullable: true })
  addressState?: string;

  @Column({ nullable: true })
  addressZipCode?: string;

  @Column({ nullable: true })
  addressLatitude?: number;

  @Column({ nullable: true })
  addressLongitude?: number;

  @Column({ nullable: true })
  addressMapsUrl?: string;

  @Column({ type: 'enum', enum: StatusDelivery })
  status: StatusDelivery;

  @Column({ unique: false })
  establishment: UserEntity;

  @Column({ unique: false, nullable: true })
  motoboy: UserEntity;

  @Column()
  value: string;

  @Column()
  observation: string;

  @Column({ nullable: true })
  destinationObservation?: string;

  @Column({ default: false })
  destinationObservationConfirmed?: boolean;

  @Column()
  soda: string;

  @Column({ type: 'enum', enum: PaymentType })
  payment: PaymentType;

  @Column()
  isActive: boolean;

  @Column()
  createdAt: Date;

  @Column({ nullable: true })
  createdBy: string;

  @Column()
  updatedAt: Date;

  @Column()
  onCoursedAt: Date;

  @Column()
  collectedAt: Date;

  @Column({ nullable: true })
  arrivedAtStoreAt?: Date;

  @Column({ nullable: true })
  ifoodStatus?: string;

  @Column({ nullable: true })
  externalStatus?: string;

  @Column({ nullable: true })
  logisticsStatus?: string;

  @Column({ nullable: true })
  ifoodOrderId?: string;

  @Column({ nullable: true })
  ifoodDisplayId?: string;

  @Column({ nullable: true })
  orderLocator?: string;

  @Column({ nullable: true })
  ifoodMerchantId?: string;

  @Column({ nullable: true })
  ifoodMerchantName?: string;

  @Column({ nullable: true })
  ifoodImportedAt?: Date;
  @Column({ nullable: true })
  ifoodLastEventCode?: string;
  @Column({ nullable: true })
  ifoodLastEventFullCode?: string;
  @Column({ nullable: true })
  ifoodConfirmedAt?: Date;
  @Column({ nullable: true })
  releasedAt?: Date;
  @Column({ nullable: true })
  releasedBy?: string;

  // Menu Flow integration metadata. Kept completely separate from iFood.
  @Column({ nullable: true })
  source?: string;

  @Column({ nullable: true })
  menuFlowOrderId?: string;

  @Column({ nullable: true })
  menuFlowOrderNumber?: string;

  @Column({ nullable: true })
  menuFlowCompanyId?: string;

  @Column({ nullable: true })
  menuFlowRestaurantName?: string;

  @Column({ nullable: true })
  menuFlowSubtotalCents?: number;

  @Column({ nullable: true })
  menuFlowDeliveryFeeCents?: number;

  @Column({ nullable: true })
  menuFlowServiceFeeCents?: number;

  @Column({ nullable: true })
  menuFlowDiscountCents?: number;

  @Column({ nullable: true })
  menuFlowTotalCents?: number;

  @Column({ nullable: true })
  menuFlowPaymentMethod?: string;

  @Column({ nullable: true })
  menuFlowNeedsChange?: boolean;

  @Column({ nullable: true })
  menuFlowChangeForCents?: number;

  @Column({ nullable: true })
  menuFlowExpectedChangeCents?: number;

  @Column({ nullable: true })
  menuFlowItems?: Array<{
    productName: string;
    quantity: number;
    unitPriceCents: number;
    observation?: string;
    addons?: Array<{ name: string; groupName?: string; priceCents: number }>;
  }>;

  @Column({ nullable: true })
  menuFlowImportedAt?: Date;

  @Column({ default: false })
  menuFlowSyncPending?: boolean;

  @Column({ nullable: true })
  menuFlowLastSyncAt?: Date;

  @Column({ nullable: true })
  menuFlowLastSyncedStatus?: string;

  @Column({ nullable: true })
  menuFlowSyncError?: string;

  @Column({ nullable: true })
  arrivedAtDestinationAt?: Date;

  @Column()
  finishedAt: Date;

  @Column({ default: false })
  ifoodAssignDriverSynced?: boolean;

  @Column({ default: false })
  ifoodGoingToOriginSynced?: boolean;

  @Column({ default: false })
  ifoodArrivedAtOriginSynced?: boolean;

  @Column({ default: false })
  ifoodDispatchSynced?: boolean;

  @Column({ default: false })
  ifoodArrivedAtDestinationSynced?: boolean;
}
