import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryEntity, UserEntity } from '../database/entities';
import { DeliveryModule } from '../delivery/delivery.module';
import { MenuFlowIntegrationController } from './menuflow-integration.controller';
import { MenuFlowIntegrationGuard } from './menuflow-integration.guard';
import { MenuFlowIntegrationService } from './menuflow-integration.service';
import { MenuFlowStatusSyncService } from './menuflow-status-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, DeliveryEntity]),
    forwardRef(() => DeliveryModule),
  ],
  controllers: [MenuFlowIntegrationController],
  providers: [
    MenuFlowIntegrationService,
    MenuFlowIntegrationGuard,
    MenuFlowStatusSyncService,
  ],
  exports: [MenuFlowStatusSyncService],
})
export class MenuFlowIntegrationModule {}
