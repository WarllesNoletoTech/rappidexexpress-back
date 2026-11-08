import { Module, forwardRef } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CityEntity,
  DeliveryEntity,
  LogEntity,
  UserEntity,
} from '../database/entities';
import { OrdersGateway } from '../gateway/orders.gateway';
import { IfoodModule } from '../ifood/ifood.module';
import { RegionsModule } from '../regions/regions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      DeliveryEntity,
      LogEntity,
      CityEntity,
    ]),
    forwardRef(() => IfoodModule),
    RegionsModule,
  ],
  controllers: [DeliveryController],
  providers: [DeliveryService, OrdersGateway],
  exports: [DeliveryService, OrdersGateway],
})
export class DeliveryModule {}
