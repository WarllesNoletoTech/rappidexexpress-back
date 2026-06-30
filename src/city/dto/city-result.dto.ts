import { Expose, plainToClass } from 'class-transformer';
import { CityEntity } from '../../database/entities/city.entity';

export class CityResult {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  state?: string;

  @Expose()
  clientWhatsappMessage?: string;

<<<<<<< HEAD
  @Expose()
  deliveryValue?: string;

  @Expose()
  deliveryFeeValue?: number;

  @Expose()
  monthlyFeeValue?: number;

  @Expose()
  pixKey?: string;

  @Expose()
  adminWhatsapp?: string;

  @Expose()
  whatsappPhoneNumberId?: string;

  @Expose()
  whatsappCloudTokenConfigured?: boolean;

=======
>>>>>>> parent of 613ac8c (atualização front)
  static fromEntity(city: CityEntity): CityResult {
    return plainToClass(CityResult, {
      id: city.id?.toHexString?.() ?? `${city.id}`,
      name: city.name,
      state: city.state,
      clientWhatsappMessage: city.clientWhatsappMessage,
<<<<<<< HEAD
      deliveryValue: city.deliveryValue,
      deliveryFeeValue: city.deliveryFeeValue,
      monthlyFeeValue: city.monthlyFeeValue,
      pixKey: city.pixKey,
      adminWhatsapp: city.adminWhatsapp,
      whatsappPhoneNumberId: city.whatsappPhoneNumberId,
      whatsappCloudTokenConfigured: Boolean(
        String(city.whatsappCloudToken ?? '').trim(),
      ),
=======
>>>>>>> parent of 613ac8c (atualização front)
    });
  }
}