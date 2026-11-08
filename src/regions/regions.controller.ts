import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../authenticator/guards/jwt-auth.guard';
import { User } from '../shared/decorators';
import { UserRequest } from '../shared/interfaces';
import { RegionsService } from './regions.service';

@UseGuards(JwtAuthGuard)
@Controller('regions')
export class RegionsController {
  constructor(private readonly service: RegionsService) {}

  @Get(':cityId/neighborhoods')
  list(@Param('cityId') id: string, @User() user: UserRequest) { return this.service.list(id, user); }

  @Get(':cityId/neighborhoods/suggestions')
  suggestions(@Param('cityId') id:string,@User() user:UserRequest) {return this.service.suggestions(id,user);}

  @Post(':cityId/neighborhoods/auto-import')
  autoImport(@Param('cityId') id: string, @User() user: UserRequest) {
    return this.service.autoImport(id, user);
  }

  @Post(':cityId/neighborhoods')
  add(@Param('cityId') id: string, @User() user: UserRequest, @Body() body: {names: string[]}) {
    return this.service.addMany(id, user, body.names);
  }

  @Put(':cityId/neighborhoods/:neighborhoodId')
  update(@Param('cityId') cityId: string, @Param('neighborhoodId') neighborhoodId: string, @User() user: UserRequest, @Body() body: {name?: string; active?: boolean; motoboyFee?: number | null}) {
    return this.service.updateNeighborhood(cityId, neighborhoodId, user, body);
  }

  @Get(':cityId/pending-fees')
  pendingFees(@Param('cityId') id:string,@User() user:UserRequest){return this.service.pendingFees(id,user);}

  @Put(':cityId/deliveries/:deliveryId/resolve-fee')
  resolveFee(@Param('cityId') id:string,@Param('deliveryId') deliveryId:string,@Body() body:{neighborhoodId:string},@User() user:UserRequest){
    return this.service.resolveFee(id,deliveryId,body.neighborhoodId,user);
  }

  @Get(':cityId/stores')
  stores(@Param('cityId') cityId: string, @User() user: UserRequest) {
    return this.service.stores(cityId, user);
  }

  @Get(':cityId/stores/:storeId/rates')
  rates(@Param('cityId') cityId: string, @Param('storeId') storeId: string, @User() user: UserRequest) {
    return this.service.getRates(cityId, storeId, user);
  }

  @Put(':cityId/stores/:storeId/rates')
  saveRates(@Param('cityId') cityId: string, @Param('storeId') storeId: string, @User() user: UserRequest, @Body() body: {rates: Array<{neighborhoodId: string; enabled: boolean; deliveryFee: number}>}) {
    return this.service.setRates(cityId, storeId, user, body.rates);
  }
}
