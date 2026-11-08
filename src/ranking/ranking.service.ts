import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ObjectId } from 'mongodb';
import { CityEntity } from '../database/entities/city.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UserType } from '../shared/constants/enums.constants';
import { UserRequest } from '../shared/interfaces';
import { RankingPointEntity } from './ranking-point.entity';
import { RankingRuleEntity } from './ranking-rule.entity';

const RULES = [
  'Manter-se ativo nos finais de semana previstos na escala',
  'Manter-se disponível nos dias de chuva, quando houver condições seguras',
  'Manter-se ativo nos feriados previstos na escala',
  'Entrar na ativa no horário definido para o expediente',
  'Seguir ativo até o fim do expediente (23h30), conforme a escala',
  'Motocicleta emplacada, regular e com escapamento original',
  'Vestimenta e proteção adequadas: capacete, calça e sapato fechado',
  'Realizar entregas sem distinção entre estabelecimentos, observando a segurança',
  'Manter a bag limpa, conservada e sem usá-la como apoio dos pés',
  'Tratar com cortesia motoboys, clientes, lojistas e a Central',
];
const OFFSET = 3 * 60 * 60 * 1000; // America/Belem: UTC-3
export function weekStartBelem(value: Date = new Date()): Date {
  const local = new Date(value.getTime() - OFFSET);
  const weekday = local.getUTCDay(); // 0=domingo, 2=terça
  const back = (weekday - 2 + 7) % 7;
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - back);
  return new Date(local.getTime() + OFFSET);
}
export function parseRankingWeek(day?: string): Date {
  if (!day) return weekStartBelem();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException('Data inválida.');
  const asDate = new Date(`${day}T03:00:00.000Z`);
  if (Number.isNaN(asDate.getTime()) || asDate.toISOString().slice(0, 10) !== day || asDate.getUTCDay() !== 2) {
    throw new BadRequestException('Informe uma terça-feira válida (AAAA-MM-DD).');
  }
  return asDate;
}

@Injectable()
export class RankingService {
  constructor(
    @InjectRepository(CityEntity) private readonly cities: MongoRepository<CityEntity>,
    @InjectRepository(UserEntity) private readonly users: MongoRepository<UserEntity>,
    @InjectRepository(RankingRuleEntity) private readonly rules: MongoRepository<RankingRuleEntity>,
    @InjectRepository(RankingPointEntity) private readonly points: MongoRepository<RankingPointEntity>,
  ) {}
  private async access(cityId: string, user: UserRequest, admin = false) {
    if (user.type !== UserType.SUPERADMIN && user.cityId !== cityId) throw new UnauthorizedException('Sem acesso a esta cidade.');
    if (admin && ![UserType.SUPERADMIN, UserType.ADMIN].includes(user.type as UserType)) throw new UnauthorizedException('Apenas administradores podem modificar o ranking.');
    if (!ObjectId.isValid(cityId) || !(await this.cities.findOne({where:{_id:new ObjectId(cityId)}}))) {
      throw new NotFoundException('Cidade não encontrada.');
    }
  }
  private async seed(cityId: string) {
    const existing = await this.rules.count({where: {cityId}});
    if (existing) return;
    for (let i = 0; i < RULES.length; i++) {
      await this.rules.updateOne({ cityId, order: i }, { $setOnInsert: {
        id: uuid(), cityId, title: RULES[i], order:i, active:true, updatedAt:new Date(),
      }}, {upsert:true});
    }
  }
  async listRules(cityId: string, user: UserRequest) {
    await this.access(cityId, user);
    await this.seed(cityId);
    return this.rules.find({where:{cityId}, order:{order:'ASC'}});
  }
  async addRule(cityId: string, user: UserRequest, title: string) {
    await this.access(cityId, user, true);
    const normalized = String(title||'').trim();
    if (!normalized || normalized.length > 300) throw new BadRequestException('Critério inválido.');
    const existing = await this.listRules(cityId, user);
    if (existing.length >= 100) throw new BadRequestException('Limite de 100 regras por cidade.');
    const rule = await this.rules.save({id:uuid(), cityId, title:normalized, order:existing.length, active:true, updatedAt:new Date()});
    return rule;
  }
  async updateRule(cityId: string, ruleId: string, user: UserRequest, data: {title?:string; active?:boolean; order?:number}) {
    await this.access(cityId, user, true);
    const rule = await this.rules.findOne({where:{id:ruleId,cityId}});
    if (!rule) throw new NotFoundException('Regra não encontrada.');
    const update: Record<string, unknown> = {updatedAt:new Date()};
    if (data.title !== undefined) {
      const title = String(data.title).trim();
      if (!title || title.length>300) throw new BadRequestException('Descrição inválida.');
      update.title = title;
    }
    if (data.active !== undefined) {
      if (typeof data.active !== 'boolean') throw new BadRequestException('Situação inválida.');
      update.active = data.active;
    }
    if (data.order !== undefined) {
      if (!Number.isInteger(data.order) || data.order < 0 || data.order > 100) throw new BadRequestException('Ordem inválida.');
      const other = await this.rules.findOne({where:{cityId,order:data.order}});
      if (other && other.id !== rule.id) {
        await this.rules.updateOne({cityId,id:other.id},{$set:{order:rule.order,updatedAt:new Date()}});
      }
      update.order = data.order;
    }
    await this.rules.updateOne({id:ruleId,cityId},{$set:update});
    return this.listRules(cityId,user);
  }
  async drivers(cityId: string, user: UserRequest) {
    await this.access(cityId, user, true);
    const users = await this.users.find({where:{cityId,type:UserType.MOTOBOY}});
    return users.map(u=>({id:u.id,name:u.name,isActive:u.isActive})).sort((a,b)=>a.name.localeCompare(b.name));
  }
  async award(cityId: string,user:UserRequest,data:{motoboyId:string;ruleId:string;points:number;note?:string}) {
    await this.access(cityId,user,true);
    if (!Number.isInteger(data.points) || data.points < 1 || data.points > 1000) throw new BadRequestException('Pontos devem ser inteiros de 1 a 1000.');
    const [motoboy,rule] = await Promise.all([
      this.users.findOne({where:{id:data.motoboyId,cityId,type:UserType.MOTOBOY}}),
      this.rules.findOne({where:{id:data.ruleId,cityId}}),
    ]);
    if (!motoboy) throw new NotFoundException('Entregador não encontrado.');
    if (!rule || !rule.active) throw new BadRequestException('Regra inexistente ou inativa.');
    if (String(data.note||'').length > 500) throw new BadRequestException('Observação muito longa.');
    return this.points.save({ id:uuid(), cityId, motoboyId:motoboy.id, motoboyName:motoboy.name,
      ruleId:rule.id, ruleTitleSnapshot:rule.title, points:data.points, weekStart:weekStartBelem(),
      awardedBy:user.id, awardedAt:new Date(), note:String(data.note||'').trim() });
  }
  async reverse(cityId:string,id:string,user:UserRequest) {
    await this.access(cityId,user,true);
    const event = await this.points.findOne({where:{id,cityId}});
    if (!event) throw new NotFoundException('Lançamento não encontrado.');
    if (event.reversedAt) throw new BadRequestException('Pontuação já estornada.');
    if (weekStartBelem(new Date(event.awardedAt)).getTime() !== weekStartBelem().getTime()) {
      throw new BadRequestException('A semana anterior já foi encerrada. Pontuações históricas ficam bloqueadas.');
    }
    const result = await this.points.updateOne({id,cityId,reversedAt:{$exists:false}},{$set:{reversedAt:new Date(), reversedBy:user.id}});
    if (!result.modifiedCount) throw new BadRequestException('Pontuação já estornada por outro administrador.');
    return {success:true};
  }
  async leaderboard(cityId:string,user:UserRequest,day?:string,includeAll=false) {
    await this.access(cityId,user);
    const start = parseRankingWeek(day);
    const end = new Date(start.getTime()+7*24*3600*1000);
    const events = await this.points.find({where:{cityId,weekStart:{$gte:start,$lt:end}}});
    const scores = new Map<string,{motoboyId:string;name:string;points:number;lastAwardedAt:number}>();
    for (const event of events) {
      if (event.reversedAt) continue;
      const entry = scores.get(event.motoboyId)||{motoboyId:event.motoboyId,name:event.motoboyName,points:0,lastAwardedAt:0};
      entry.points += event.points;
      entry.lastAwardedAt = Math.max(entry.lastAwardedAt,new Date(event.awardedAt).getTime());
      scores.set(event.motoboyId,entry);
    }
    const all = [...scores.values()].sort((a,b)=>b.points-a.points || a.lastAwardedAt-b.lastAwardedAt || a.name.localeCompare(b.name))
      .map((x,i)=>({position:i+1,motoboyId:x.motoboyId,name:x.name,points:x.points}));
    const admin = [UserType.SUPERADMIN,UserType.ADMIN].includes(user.type as UserType);
    return {cityId,weekStart:start.toISOString(),weekEnd:new Date(end.getTime()-1).toISOString(),
      top5:all.slice(0,5), ...(includeAll && admin?{all}:{}),
    };
  }
  async history(cityId:string,user:UserRequest,day?:string) {
    await this.access(cityId,user,true);
    const start = parseRankingWeek(day);
    const end = new Date(start.getTime()+7*24*3600*1000);
    return this.points.find({where:{cityId,weekStart:{$gte:start,$lt:end}},order:{awardedAt:'DESC'}});
  }
}
