import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { MenuFlowDeliveryDto } from './menuflow-integration.dto';
import { MenuFlowIntegrationGuard } from './menuflow-integration.guard';
import { MenuFlowIntegrationService } from './menuflow-integration.service';

@Controller('integrations/menuflow')
@UseGuards(MenuFlowIntegrationGuard)
export class MenuFlowIntegrationController {
  constructor(private readonly integration: MenuFlowIntegrationService) {}

  @Post('deliveries')
  createDelivery(@Body() body: MenuFlowDeliveryDto) {
    return this.integration.createDelivery(body);
  }

  @Post('deliveries/:menuFlowOrderId/release')
  releaseDelivery(@Param('menuFlowOrderId') orderId: string) {
    return this.integration.releaseDelivery(orderId);
  }

  @Post('deliveries/:menuFlowOrderId/cancel')
  cancelDelivery(@Param('menuFlowOrderId') orderId: string) {
    return this.integration.cancelDelivery(orderId);
  }
}
