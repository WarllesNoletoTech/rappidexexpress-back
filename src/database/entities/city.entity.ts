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

  // Somente para leitura de histórico de pedidos antigos: não cobrada no novo modelo por bairro.
  @Column({ nullable: true })
  platformServiceFee?: number;

  @Column({ nullable: true })
  feeModeActivatedAt?: Date;

  @Column({ nullable: true })
  neighborhoodOsmSourceId?: string;

  @Column({ nullable: true })
  neighborhoodOsmSourceLabel?: string;

  @Column({ nullable: true })
  neighborhoods?: Array<{ id: string; name: string; active: boolean; deliveryFee?: number; motoboyFee?: number; aliases?: string[] }>;

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
