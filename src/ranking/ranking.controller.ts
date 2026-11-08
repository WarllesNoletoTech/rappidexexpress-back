import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../authenticator/guards/jwt-auth.guard';
import { User } from '../shared/decorators';
import { UserRequest } from '../shared/interfaces';
import { RankingService } from './ranking.service';

@UseGuards(JwtAuthGuard)
@Controller('ranking')
export class RankingController {
  constructor(private readonly service:RankingService) {}
  @Get('my-notifications')
  pendingNotifications(@User() user: UserRequest) { return this.service.unreadNotifications(user); }
  @Post('my-notifications/:pointId/ack')
  acknowledgeNotification(@User() user: UserRequest, @Param('pointId') pointId: string) {
    return this.service.acknowledgeNotification(user, pointId);
  }
  @Get(':cityId')
  board(@Param('cityId') id:string,@User() user:UserRequest,@Query('week') week?:string) {
    return this.service.leaderboard(id,user,week);
  }
  @Get(':cityId/details')
  details(@Param('cityId') id:string,@User() user:UserRequest,@Query('week') week?:string) {
    return this.service.leaderboard(id,user,week,true);
  }
  @Get(':cityId/rules')
  rules(@Param('cityId') id:string,@User() user:UserRequest) {return this.service.listRules(id,user);}
  @Post(':cityId/rules')
  addRule(@Param('cityId') id:string,@User() user:UserRequest,@Body() body:{title:string}) {
    return this.service.addRule(id,user,body.title);
  }
  @Put(':cityId/rules/:ruleId')
  updateRule(@Param('cityId') id:string,@Param('ruleId') ruleId:string,@User() user:UserRequest,@Body() body:{title?:string;active?:boolean;order?:number}) {
    return this.service.updateRule(id,ruleId,user,body);
  }
  @Get(':cityId/drivers')
  drivers(@Param('cityId') id:string,@User() user:UserRequest) {return this.service.drivers(id,user);}
  @Get(':cityId/points')
  history(@Param('cityId') id:string,@User() user:UserRequest,@Query('week') week?:string) {return this.service.history(id,user,week);}
  @Post(':cityId/points')
  award(@Param('cityId') id:string,@User() user:UserRequest,@Body() body:{motoboyId:string;ruleId:string;points:number;note?:string}) {return this.service.award(id,user,body);}
  @Post(':cityId/points/:pointId/reverse')
  reverse(@Param('cityId') id:string,@Param('pointId') pointId:string,@User() user:UserRequest) {return this.service.reverse(id,pointId,user);}
}
