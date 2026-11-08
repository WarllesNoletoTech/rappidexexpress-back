import { Entity, ObjectIdColumn, Column } from 'typeorm';
import { ObjectId } from 'mongodb';

@Entity()
export class CityEntity {
  @ObjectIdColumn()
  id: ObjectId;

  @Column()
  name: string;

  @Column({ nullable: false })
  state?: string;

  @Column({ nullable: true })
  clientWhatsappMessage?: string;

  @Column({ nullable: true })
  feeMode?: 'fixed' | 'neighborhood';

  // Taxa da plataforma apenas para o modo por bairro. Não substitui deliveryFeeValue (legado).
  @Column({ nullable: true })
  platformServiceFee?: number;

  @Column({ nullable: true })
  feeModeActivatedAt?: Date;

  @Column({ nullable: true })
  neighborhoods?: Array<{ id: string; name: string; active: boolean }>;

  @Column({ nullable: true })
  deliveryValue?: string;

  @Column({ nullable: true })
  deliveryFeeValue?: number;

  @Column({ nullable: true })
  monthlyFeeValue?: number;

  @Column({ nullable: true })
  pixKey?: string;

  @Column({ nullable: true })
  adminWhatsapp?: string;

  @Column({ nullable: true })
  whatsappPhoneNumberId?: string;

  @Column({ nullable: true })
  whatsappCloudToken?: string;
}
