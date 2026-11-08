import { Column, Entity, ObjectIdColumn } from 'typeorm';
import { ObjectId } from 'mongodb';

@Entity()
export class RankingRuleEntity {
  @ObjectIdColumn() internalId: ObjectId;
  @Column() id: string;
  @Column() cityId: string;
  @Column() title: string;
  @Column() order: number;
  @Column() active: boolean;
  @Column() updatedAt: Date;
}

