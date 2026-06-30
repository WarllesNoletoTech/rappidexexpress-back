import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectId } from 'mongodb';
import { MongoRepository } from 'typeorm';

import { CityEntity } from '../database/entities/city.entity';
import { CityResult, CreateCityDto, UpdateCityDto } from './dto';

@Injectable()
export class CityService {
  constructor(
    @InjectRepository(CityEntity)
    private readonly cityRepository: MongoRepository<CityEntity>,
  ) {}

<<<<<<< HEAD
<<<<<<< HEAD
  private normalizeCurrencyValue(value?: number | string): number | undefined {
=======
  private normalizeDeliveryFeeValue(
    value?: number | string,
  ): number | undefined {
>>>>>>> parent of 5803b8a (revert)
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const normalized = String(value).includes(',')
      ? String(value).replace(/\./g, '').replace(',', '.')
      : String(value);
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : undefined;
<<<<<<< HEAD
  }

=======
>>>>>>> parent of 613ac8c (atualização front)
  async listCities(): Promise<CityResult[]> {
      const cities = await this.cityRepository.find({
        order: { name: 'ASC' },
      });
      return cities.map(CityResult.fromEntity);
=======
>>>>>>> parent of 5803b8a (revert)
  }

  async listCities(): Promise<CityResult[]> {
    const cities = await this.cityRepository.find({
      order: { name: 'ASC' },
    });
    return cities.map(CityResult.fromEntity);
  }

  async createCity(data: CreateCityDto): Promise<CityResult> {
    const city = await this.cityRepository.save({
      name: data.name,
      state: data.state,
      clientWhatsappMessage: data.clientWhatsappMessage?.trim() || '',
<<<<<<< HEAD
<<<<<<< HEAD
      deliveryValue: data.deliveryValue?.trim() || '',
      deliveryFeeValue: this.normalizeCurrencyValue(data.deliveryFeeValue),
      monthlyFeeValue: this.normalizeCurrencyValue(data.monthlyFeeValue),
=======
      deliveryValue: data.deliveryValue?.trim() || '',
      deliveryFeeValue: this.normalizeDeliveryFeeValue(data.deliveryFeeValue),
>>>>>>> parent of 5803b8a (revert)
      pixKey: data.pixKey?.trim() || '',
      adminWhatsapp: data.adminWhatsapp?.trim() || '',
      whatsappPhoneNumberId: data.whatsappPhoneNumberId?.trim() || '',
      whatsappCloudToken: data.whatsappCloudToken?.trim() || '',
<<<<<<< HEAD
=======
>>>>>>> parent of 613ac8c (atualização front)
=======
>>>>>>> parent of 5803b8a (revert)
    });

    return CityResult.fromEntity(city);
  }

  async findCity(cityId: string): Promise<CityResult> {
    const city = await this.cityRepository.findOne({
      where: { _id: new ObjectId(cityId) },
    });

    if (!city) {
      throw new NotFoundException('Cidade não encontrada.');
    }

    return CityResult.fromEntity(city);
  }

  async updateCity(cityId: string, data: UpdateCityDto): Promise<CityResult> {
    const city = await this.cityRepository.findOne({
      where: { _id: new ObjectId(cityId) },
    });

    if (!city) {
      throw new NotFoundException('Cidade não encontrada.');
    }

    const updatedCity = await this.cityRepository.save({
      ...city,
      ...data,
      clientWhatsappMessage:
        data.clientWhatsappMessage !== undefined
          ? data.clientWhatsappMessage.trim()
          : city.clientWhatsappMessage,
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> parent of 5803b8a (revert)
      deliveryValue:
        data.deliveryValue !== undefined
          ? data.deliveryValue.trim()
          : city.deliveryValue,
      deliveryFeeValue:
        data.deliveryFeeValue !== undefined
<<<<<<< HEAD
          ? this.normalizeCurrencyValue(data.deliveryFeeValue)
          : city.deliveryFeeValue,
      monthlyFeeValue:
        data.monthlyFeeValue !== undefined
          ? this.normalizeCurrencyValue(data.monthlyFeeValue)
          : city.monthlyFeeValue,
=======
          ? this.normalizeDeliveryFeeValue(data.deliveryFeeValue)
          : city.deliveryFeeValue,
>>>>>>> parent of 5803b8a (revert)
      pixKey: data.pixKey !== undefined ? data.pixKey.trim() : city.pixKey,
      adminWhatsapp:
        data.adminWhatsapp !== undefined
          ? data.adminWhatsapp.trim()
          : city.adminWhatsapp,
      whatsappPhoneNumberId:
        data.whatsappPhoneNumberId !== undefined
          ? data.whatsappPhoneNumberId.trim()
          : city.whatsappPhoneNumberId,
      whatsappCloudToken:
        data.whatsappCloudToken !== undefined && data.whatsappCloudToken.trim()
          ? data.whatsappCloudToken.trim()
          : city.whatsappCloudToken,
<<<<<<< HEAD
=======
>>>>>>> parent of 613ac8c (atualização front)
=======
>>>>>>> parent of 5803b8a (revert)
    });

    return CityResult.fromEntity(updatedCity);
  }

  async deleteCity(cityId: string): Promise<void> {
    const city = await this.cityRepository.findOne({
      where: { _id: new ObjectId(cityId) },
    });

    if (!city) {
      throw new NotFoundException('Cidade não encontrada.');
    }

    await this.cityRepository.delete(city.id);
  }
}
