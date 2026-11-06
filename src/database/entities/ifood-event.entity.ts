import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity()
export class IfoodEventEntity {
  @ObjectIdColumn()
  internalId: ObjectId;

  @Column()
  @Index({ unique: true })
  eventId: string;

  @Column()
  orderId: string;

  @Column()
  merchantId: string;

  @Column()
  code: string;

  @Column()
  fullCode: string;

  @Column({ nullable: true })
  salesChannel?: string;

  /** Origem autenticada do evento; registros antigos ficam sem origem confiável. */
  @Column({ nullable: true })
  verifiedSource?: 'POLLING' | 'WEBHOOK_VERIFIED';

  @Column({ nullable: true })
  createdAt?: string;

  @Column()
  processedAt: Date;

  @Column({ default: false })
  acknowledged: boolean;
}