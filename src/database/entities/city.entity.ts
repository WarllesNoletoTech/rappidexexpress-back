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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> parent of 5803b8a (revert)

  @Column({ nullable: true })
  deliveryValue?: string;

  @Column({ nullable: true })
  deliveryFeeValue?: number;

  @Column({ nullable: true })
<<<<<<< HEAD
  monthlyFeeValue?: number;

  @Column({ nullable: true })
=======
>>>>>>> parent of 5803b8a (revert)
  pixKey?: string;

  @Column({ nullable: true })
  adminWhatsapp?: string;

  @Column({ nullable: true })
  whatsappPhoneNumberId?: string;

  @Column({ nullable: true })
  whatsappCloudToken?: string;
}
<<<<<<< HEAD
=======
}
>>>>>>> parent of 613ac8c (atualização front)
=======
>>>>>>> parent of 5803b8a (revert)
