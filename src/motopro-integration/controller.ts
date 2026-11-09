import {Body,Controller,Delete,Get,Post,Query,UseGuards} from '@nestjs/common';
import {IsString,Matches} from 'class-validator';
import {JwtAuthGuard} from '../authenticator/guards/jwt-auth.guard';
import {User} from '../shared/decorators';
import {UserRequest} from '../shared/interfaces';
import {MotoProIntegrationService} from './service';
import {MotoProGuard} from './guard';
class LinkDto{
 @IsString() @Matches(/^[a-f\d]{48}$/i) code:string;
 @IsString() @Matches(/^[a-f\d]{24}$/i) motoproUserId:string;
}
class UnlinkDto{
 @IsString() @Matches(/^[a-f\d]{24}$/i) motoproUserId:string;
 @IsString() motoboyId:string;
}
@Controller('motopro') export class MotoProIntegrationController{
 constructor(private readonly service:MotoProIntegrationService){}
 @Get('status') @UseGuards(JwtAuthGuard) status(@User() user:UserRequest){return this.service.status(user.id);}
 @Post('link-code') @UseGuards(JwtAuthGuard) code(@User() user:UserRequest){return this.service.code(user.id);}
 @Delete('link') @UseGuards(JwtAuthGuard) unlinkSelf(@User() user:UserRequest){return this.service.unlinkSelf(user.id);}
 @Post('connect') @UseGuards(MotoProGuard) connect(@Body() b:LinkDto){return this.service.claim(b.code,b.motoproUserId);}
 @Post('disconnect') @UseGuards(MotoProGuard) disconnect(@Body() b:UnlinkDto){return this.service.unlink(b.motoproUserId,b.motoboyId);}
 @Get('earnings') @UseGuards(MotoProGuard)
 earnings(@Query('motoproUserId') id:string,@Query('from') from:string,@Query('to') to:string,@Query('page') page='1'){
  return this.service.earnings(id,from,to,Number(page));
 }
}
