import { forwardRef, Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module';
import { MenuFlowIntegrationController } from './menuflow-integration.controller';
import { MenuFlowIntegrationGuard } from './menuflow-integration.guard';
import { MenuFlowIntegrationService } from './menuflow-integration.service';
import { MenuFlowStatusSyncService } from './menuflow-status-sync.service';

@Module({
  imports: [forwardRef(() => DeliveryModule)],
  controllers: [MenuFlowIntegrationController],
  providers: [
    MenuFlowIntegrationService,
    MenuFlowIntegrationGuard,
    MenuFlowStatusSyncService,
  ],
  exports: [MenuFlowStatusSyncService],
})
export class MenuFlowIntegrationModule {}
