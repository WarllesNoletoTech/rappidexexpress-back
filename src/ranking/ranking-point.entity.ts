import { Column, Entity, ObjectIdColumn } from 'typeorm';
import { ObjectId } from 'mongodb';

@Entity()
export class RankingPointEntity {
  @ObjectIdColumn() internalId: ObjectId;
  @Column() id: string;
  @Column() cityId: string;
  @Column() motoboyId: string;
  @Column() motoboyName: string;
  @Column() ruleId: string;
  @Column() ruleTitleSnapshot: string;
  @Column() points: number;
  @Column() weekStart: Date;
  @Column() awardedBy: string;
  @Column() awardedAt: Date;
  @Column({ nullable: true }) note?: string;
  // Somente novos lancamentos recebem notificacao; registros historicos permanecem intactos.
  @Column({ nullable: true }) notificationStatus?: 'pending' | 'read';
  @Column({ nullable: true }) notificationReadAt?: Date;
  @Column({ nullable: true }) reversedAt?: Date;
  @Column({ nullable: true }) reversedBy?: string;
}
