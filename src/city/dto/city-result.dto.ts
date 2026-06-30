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
<<<<<<< HEAD
=======
>>>>>>> parent of 5803b8a (revert)
  @Expose()
  deliveryValue?: string;

  @Expose()
  deliveryFeeValue?: number;

  @Expose()
<<<<<<< HEAD
  monthlyFeeValue?: number;

  @Expose()
=======
>>>>>>> parent of 5803b8a (revert)
  pixKey?: string;

  @Expose()
  adminWhatsapp?: string;

  @Expose()
  whatsappPhoneNumberId?: string;

  @Expose()
  whatsappCloudTokenConfigured?: boolean;

<<<<<<< HEAD
=======
>>>>>>> parent of 613ac8c (atualização front)
=======
>>>>>>> parent of 5803b8a (revert)
  static fromEntity(city: CityEntity): CityResult {
    return plainToClass(CityResult, {
      id: city.id?.toHexString?.() ?? `${city.id}`,
      name: city.name,
      state: city.state,
      clientWhatsappMessage: city.clientWhatsappMessage,
<<<<<<< HEAD
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
=======
      deliveryValue: city.deliveryValue,
      deliveryFeeValue: city.deliveryFeeValue,
      pixKey: city.pixKey,
      adminWhatsapp: city.adminWhatsapp,
      whatsappPhoneNumberId: city.whatsappPhoneNumberId,
      whatsappCloudTokenConfigured: Boolean(String(city.whatsappCloudToken ?? '').trim()),
>>>>>>> parent of 5803b8a (revert)
    });
  }
}
