import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CityEntity } from '../database/entities/city.entity';
import { UserEntity } from '../database/entities/user.entity';
import { DeliveryEntity } from '../database/entities/delivery.entity';
import { RegionsController } from './regions.controller';
import { RegionsService } from './regions.service';

@Module({
  imports: [TypeOrmModule.forFeature([CityEntity, UserEntity, DeliveryEntity])],
  providers: [RegionsService],
  controllers: [RegionsController],
  exports: [RegionsService],
})
export class RegionsModule {}
