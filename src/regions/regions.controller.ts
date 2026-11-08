import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../authenticator/guards/jwt-auth.guard';
import { User } from '../shared/decorators';
import { UserRequest } from '../shared/interfaces';
import { RegionsService } from './regions.service';

@UseGuards(JwtAuthGuard)
@Controller('regions')
export class RegionsController {
  constructor(private readonly service: RegionsService) {}

  @Get(':cityId/neighborhoods')
  list(@Param('cityId') id:string,@User() user:UserRequest){return this.service.list(id,user);}

  @Post(':cityId/neighborhoods')
  add(@Param('cityId') id:string,@User() user:UserRequest,@Body() body:{names?:string[];items?:Array<{name:string;deliveryFee?:number;motoboyFee?:number;active?:boolean}>}){
    return this.service.addMany(id,user,body?.items??body?.names);
  }
  @Put(':cityId/neighborhoods/:neighborhoodId')
  update(@Param('cityId') cityId:string,@Param('neighborhoodId') neighborhoodId:string,@User() user:UserRequest,
    @Body() body:{name?:string;active?:boolean;deliveryFee?:number|null;motoboyFee?:number|null}){
    return this.service.updateNeighborhood(cityId,neighborhoodId,user,body);
  }
  @Delete(':cityId/neighborhoods/:neighborhoodId')
  remove(@Param('cityId') cityId:string,@Param('neighborhoodId') id:string,@User() user:UserRequest){
    return this.service.removeNeighborhood(cityId,id,user);
  }
  @Get(':cityId/pending-fees')
  pendingFees(@Param('cityId') id:string,@User() user:UserRequest){return this.service.pendingFees(id,user);}
  @Put(':cityId/deliveries/:deliveryId/resolve-fee')
  resolveFee(@Param('cityId') id:string,@Param('deliveryId') deliveryId:string,
    @Body() body:{neighborhoodId:string},@User() user:UserRequest){
    return this.service.resolveFee(id,deliveryId,body.neighborhoodId,user);
  }
  @Get(':cityId/stores')
  stores(@Param('cityId') id:string,@User() user:UserRequest){return this.service.stores(id,user);}
  @Get(':cityId/stores/:storeId/rates')
  rates(@Param('cityId') id:string,@Param('storeId') storeId:string,@User() user:UserRequest){
    return this.service.getRates(id,storeId,user);
  }
  @Put(':cityId/stores/:storeId/rates')
  deprecated(@Param('cityId') id:string,@Param('storeId') storeId:string,@User() user:UserRequest,
    @Body() body:{rates:unknown}){return this.service.setRates(id,storeId,user,body?.rates);}
}
