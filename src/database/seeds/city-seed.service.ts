import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { CityEntity } from '../entities/city.entity';

const DEFAULT_CITY = {
  name: 'Redenção',
  state: 'PA',
};

@Injectable()
export class CitySeedService {
  private readonly logger = new Logger(CitySeedService.name);
  constructor(
    @InjectRepository(CityEntity)
    private readonly cityRepository: MongoRepository<CityEntity>,
  ) {}

  async seedDefaultCitySafely(): Promise<void> {
    try {
      const cityExists = await this.cityRepository.findOne({
        where: { name: DEFAULT_CITY.name, state: DEFAULT_CITY.state },
      });

      if (!cityExists) {
        await this.cityRepository.insert(DEFAULT_CITY);
      }
    } catch (error: any) {
      this.logger.warn(
        `Não foi possível executar seed de cidade padrão; servidor continuará ativo. ${error?.message || error}`,
      );
    }
  }
}
