import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {UserEntity,DeliveryEntity} from '../database/entities';
import {MotoProIntegrationController} from './controller';
import {MotoProIntegrationService} from './service';
import {MotoProGuard} from './guard';
@Module({imports:[TypeOrmModule.forFeature([UserEntity,DeliveryEntity])],controllers:[MotoProIntegrationController],providers:[MotoProIntegrationService,MotoProGuard]})
export class MotoProIntegrationModule{}
