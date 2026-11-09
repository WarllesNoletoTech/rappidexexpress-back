import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {MongoRepository} from 'typeorm';
import {createHash,randomBytes} from 'crypto';
import {UserEntity,DeliveryEntity} from '../database/entities';
import {StatusDelivery,UserType} from '../shared/constants/enums.constants';
import {deliveryDay,payoutInCents} from './payout';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function validDay(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(`${s}T12:00:00Z`))&&new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s;}
@Injectable() export class MotoProIntegrationService{
 constructor(@InjectRepository(UserEntity)private readonly users:MongoRepository<UserEntity>,
 @InjectRepository(DeliveryEntity)private readonly deliveries:MongoRepository<DeliveryEntity>){}
 private async motoboy(id:string){
  const u=await this.users.findOneBy({id});
  if(!u||u.type!==UserType.MOTOBOY||!u.isActive||u.blocked)throw new ForbiddenException('Somente motoboy ativo pode integrar.');
  return u;
 }
 async status(id:string){const u=await this.motoboy(id);return {linked:!!u.motoproLinkedUserId};}
 async code(id:string){
  await this.motoboy(id);
  const code=randomBytes(24).toString('hex'), expiresAt=new Date(Date.now()+600_000);
  await this.users.updateOne({id},{$set:{motoproLinkCodeHash:sha(code),motoproLinkExpiresAt:expiresAt}});
  return {code,expiresAt:expiresAt.toISOString()};
 }
 async unlinkSelf(id:string){await this.motoboy(id);
  await this.users.updateOne({id},{$unset:{motoproLinkedUserId:'',motoproLinkCodeHash:'',motoproLinkExpiresAt:''}});
  return {ok:true};
 }
 async claim(code:string,motoproUserId:string){
  if(!/^[a-f\d]{48}$/i.test(code)||!/^[a-f\d]{24}$/i.test(motoproUserId))throw new BadRequestException('Código inválido');
  // CAS atômico: impede reutilizar código e vincular uma conta a dois usuários diferentes.
  const found=await this.users.findOneAndUpdate({motoproLinkCodeHash:sha(code.toLowerCase()),motoproLinkExpiresAt:{$gt:new Date()},
   type:UserType.MOTOBOY,isActive:true,blocked:{$ne:true},
   $or:[{motoproLinkedUserId:{$exists:false}},{motoproLinkedUserId:motoproUserId}] } as any,
   {$set:{motoproLinkedUserId:motoproUserId},$unset:{motoproLinkCodeHash:'',motoproLinkExpiresAt:''}},{returnDocument:'after'});
  if(!found.value)throw new ConflictException('Código expirado, já usado ou conta vinculada a outro MotoPRO.');
  return {motoboyId:found.value.id,motoboyName:found.value.name};
 }
 async unlink(motoproUserId:string,motoboyId:string){
  if(!/^[a-f\d]{24}$/i.test(motoproUserId)||!motoboyId)throw new BadRequestException('Identificação inválida');
  const r=await this.users.updateOne({id:motoboyId,motoproLinkedUserId:motoproUserId},{$unset:{motoproLinkedUserId:'',motoproLinkCodeHash:'',motoproLinkExpiresAt:''}});
  if(!r.matchedCount)throw new NotFoundException('Vínculo não encontrado');
  return {ok:true};
 }
 async earnings(motoproUserId:string,from:string,to:string,page:number){
  if(!/^[a-f\d]{24}$/i.test(motoproUserId)||!validDay(from)||!validDay(to)||from>to||!Number.isSafeInteger(page)||page<1||page>100)throw new BadRequestException('Parâmetros inválidos');
  const first=Date.parse(`${from}T00:00:00Z`),last=Date.parse(`${to}T00:00:00Z`);
  if(last-first>30*86400000||last>Date.now()+86400000)throw new BadRequestException('Máximo 31 dias por consulta');
  const user=await this.users.findOneBy({motoproLinkedUserId:motoproUserId,type:UserType.MOTOBOY,isActive:true,blocked:{$ne:true}} as any);
  if(!user)throw new ForbiddenException('Vínculo revogado ou inválido.');
  const limit=100;
  const deliveries=await this.deliveries.find({where:{'motoboy.id':user.id,status:StatusDelivery.FINISHED,
   finishedAt:{$gte:new Date(first),$lt:new Date(last+86400000)}} as any,
   order:{finishedAt:'ASC',id:'ASC'},skip:(page-1)*limit,take:limit});
  const items:{id:string;amountCents:number;occurredOn:string}[]=[];
  let missingPayoutCount=0;
  for(const d of deliveries){const amountCents=payoutInCents(d);
   if(amountCents===null){missingPayoutCount++;continue;}
   items.push({id:d.id,amountCents,occurredOn:deliveryDay(d.finishedAt)});
  }
  return {items,missingPayoutCount,hasMore:deliveries.length===limit,page};
 }
}
