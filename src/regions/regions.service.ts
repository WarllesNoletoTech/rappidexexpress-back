import {
  BadRequestException, Injectable, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { v4 as uuid } from 'uuid';
import { CityEntity } from '../database/entities/city.entity';
import { UserEntity } from '../database/entities/user.entity';
import { DeliveryEntity } from '../database/entities/delivery.entity';
import { UserRequest } from '../shared/interfaces';
import { UserType } from '../shared/constants/enums.constants';

export type Neighborhood = {
  id: string; name: string; active: boolean; aliases?: string[]; deliveryFee?: number; motoboyFee?: number;
};
export type PricingSnapshot = {
  neighborhoodId?: string;
  neighborhoodDeliveryFee?: number;
  motoboyDeliveryFee?: number;
  platformServiceFee?: number;
  establishmentDeliveryCharge?: number;
  feeResolutionStatus: 'FIXED' | 'RESOLVED' | 'PENDING';
};
export function normalizedNeighborhood(value: string) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
}
export function amount(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new BadRequestException('Tipo de valor monetário inválido.');
  }
  const numeric = typeof value === 'string'
    ? Number(value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value)
    : Number(value);
  if (value === null || value === undefined || value === '' ||
      !Number.isFinite(numeric) || numeric < 0 || numeric > 100000 ||
      Math.abs(Math.round(numeric * 100) - numeric * 100) > 1e-6) {
    throw new BadRequestException('Valor monetário inválido (0 a 100.000,00; até duas casas decimais).');
  }
  return Math.round(numeric * 100) / 100;
}

type Row = { name: string; active?: boolean; deliveryFee?: number | string | null; motoboyFee?: number | string | null }; // Campos antigos ignorados no cadastro municipal.
@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(CityEntity) private readonly cities: MongoRepository<CityEntity>,
    @InjectRepository(UserEntity) private readonly users: MongoRepository<UserEntity>,
    @InjectRepository(DeliveryEntity) private readonly deliveries: MongoRepository<DeliveryEntity>,
  ) {}

  async city(cityId: string) {
    if (!ObjectId.isValid(cityId)) throw new BadRequestException('ID de cidade inválido.');
    const city = await this.cities.findOne({ where: { _id: new ObjectId(cityId) } });
    if (!city) throw new NotFoundException('Cidade não encontrada.');
    return city;
  }
  ensureCity(user: UserRequest, cityId: string) {
    if (user.type !== UserType.SUPERADMIN && user.cityId !== cityId) {
      throw new UnauthorizedException('Sem acesso a esta cidade.');
    }
  }
  ensureAdmin(user: UserRequest, cityId: string) {
    this.ensureCity(user, cityId);
    if (![UserType.ADMIN, UserType.SUPERADMIN].includes(user.type as UserType)) {
      throw new UnauthorizedException('Somente administradores podem alterar bairros e tarifas.');
    }
  }
  async list(cityId: string, user: UserRequest) {
    this.ensureCity(user, cityId);
    const city = await this.city(cityId);
    return { cityId, feeMode: city.feeMode || 'fixed', neighborhoods: (city.neighborhoods || []).map(n => ({id:n.id,name:n.name,active:n.active})) };
  }

  // CSV inclui somente os nomes dos bairros. As tarifas ficam vinculadas às lojas.
  async addMany(cityId: string, user: UserRequest, input: unknown) {
    this.ensureAdmin(user, cityId);
    if (!Array.isArray(input) || !input.length || input.length > 500) {
      throw new BadRequestException('Envie de 1 a 500 bairros por operação.');
    }
    const city = await this.city(cityId);
    const current: Neighborhood[] = (city.neighborhoods || []).map(n => ({...n}));
    const known = new Set(current.flatMap(n => [n.name, ...(n.aliases || [])].map(normalizedNeighborhood)));
    let added = 0; let duplicates = 0;
    // Valida todas as linhas antes da gravação para evitar importação parcial.
    const parsed = input.map(raw => {
      const row: Row = typeof raw === 'string' ? {name:raw} : raw;
      if (!row || typeof row.name !== 'string') throw new BadRequestException('Nome de bairro inválido no CSV.');
      const name = row.name.trim().replace(/\s+/g,' ');
      if (!name || name.length > 110 || !normalizedNeighborhood(name)) throw new BadRequestException('Nome de bairro inválido.');
      if (row.active !== undefined && typeof row.active !== 'boolean') throw new BadRequestException('Situação de bairro inválida.');
      return {name, active:row.active !== false};
    });
    for (const row of parsed) {
      const key = normalizedNeighborhood(row.name);
      if (known.has(key)) {duplicates++;continue;}
      known.add(key);
      current.push({id:uuid(), ...row});added++;
    }
    await this.cities.updateOne({ _id: city.id }, { $set: { neighborhoods: current } });
    return {added, duplicates, neighborhoods:current.map(n=>({id:n.id,name:n.name,active:n.active}))};
  }

  async updateNeighborhood(cityId: string, id: string, user: UserRequest,
    payload: {name?: string; active?: boolean; deliveryFee?: number | null; motoboyFee?: number | null}) {
    this.ensureAdmin(user, cityId);
    const city = await this.city(cityId);
    const neighborhoods: Neighborhood[] = (city.neighborhoods || []).map(n=>({...n}));
    const target = neighborhoods.find(n=>n.id===id);
    if (!target) throw new NotFoundException('Bairro não encontrado.');
    if (payload.name !== undefined) {
      if (typeof payload.name !== 'string') throw new BadRequestException('Nome inválido.');
      const name = payload.name.trim().replace(/\s+/g,' ');
      if (!name || name.length > 110 || !normalizedNeighborhood(name) ||
          neighborhoods.some(n=>n.id!==id && [n.name,...(n.aliases||[])].some(prev=>normalizedNeighborhood(prev)===normalizedNeighborhood(name)))) {
        throw new BadRequestException('Nome inválido ou bairro já cadastrado.');
      }
      if (normalizedNeighborhood(target.name)!==normalizedNeighborhood(name)) {
        target.aliases=[...(target.aliases||[]),target.name].slice(-30);
      }
      target.name=name;
    }
    if (payload.active !== undefined) {
      if (typeof payload.active !== 'boolean') throw new BadRequestException('Situação inválida.');
      target.active=payload.active;
    }
    // Valores por bairro são exclusivos de cada estabelecimento.
    // Não alterar valores legados da cidade durante a edição do nome.
    await this.cities.updateOne({_id:city.id},{$set:{neighborhoods}});
    return {neighborhoods:neighborhoods.map(n=>({id:n.id,name:n.name,active:n.active}))};
  }

  async removeNeighborhood(cityId:string,id:string,user:UserRequest) {
    this.ensureAdmin(user,cityId);
    const city=await this.city(cityId);
    const list=city.neighborhoods||[];
    if (!list.some(n=>n.id===id)) throw new NotFoundException('Bairro não encontrado.');
    const neighborhoods=list.filter(n=>n.id!==id);
    await this.cities.updateOne({_id:city.id},{$set:{neighborhoods}});
    // Históricos das entregas já possuem snapshot; nunca são recalculados.
    return {removed:true,neighborhoods:neighborhoods.map(n=>({id:n.id,name:n.name,active:n.active}))};
  }

  // Cada cidade possui somente o catálogo de bairros; cada loja tem sua própria tabela.
  async getRates(cityId:string,storeId:string,user:UserRequest){
    const [store,city]=await Promise.all([this.store(cityId,storeId,user),this.city(cityId)]);
    const byId=new Map((store.neighborhoodRates||[]).map(r=>[r.neighborhoodId,r]));
    return {storeId,storeName:store.name,feeMode:city.feeMode||'fixed',
      rates:(city.neighborhoods||[]).map(n=>{
        const own=byId.get(n.id);
        return {neighborhoodId:n.id,id:n.id,name:n.name,active:n.active,
          enabled:n.active && own?.enabled===true,
          deliveryFee:own?.deliveryFee??null,motoboyFee:own?.motoboyFee??null};
      })};
  }
  async store(cityId:string,storeId:string,user:UserRequest){
    this.ensureCity(user,cityId);
    if (![UserType.ADMIN,UserType.SUPERADMIN].includes(user.type as UserType) && user.id !== storeId) {
      throw new UnauthorizedException('Sem permissão sobre esta loja.');
    }
    const store=await this.users.findOne({where:{id:storeId}});
    if (!store||store.cityId!==cityId||![UserType.SHOPKEEPER,UserType.SHOPKEEPERADMIN].includes(store.type as UserType)) {
      throw new NotFoundException('Loja não encontrada nesta cidade.');
    }
    return store;
  }
  async stores(cityId:string,user:UserRequest){
    this.ensureAdmin(user,cityId);
    await this.city(cityId);
    const shops=await this.users.find({where:{cityId,type:{$in:[UserType.SHOPKEEPER,UserType.SHOPKEEPERADMIN]}} as any});
    return shops.map(s=>({id:s.id,name:s.name,type:s.type}));
  }
  // Escrita exclusiva do administrador. Nenhuma tarifa é herdada automaticamente da cidade.
  async setRates(cityId:string,storeId:string,user:UserRequest,input:unknown){
    this.ensureAdmin(user,cityId);
    const [store,city]=await Promise.all([this.store(cityId,storeId,user),this.city(cityId)]);
    if(!Array.isArray(input) || input.length>500)throw new BadRequestException('Envie até 500 tarifas por operação.');
    const allowed=new Map((city.neighborhoods||[]).map(n=>[n.id,n]));
    const seen=new Set<string>();
    const rows: NonNullable<UserEntity['neighborhoodRates']> = [];
    // Validar toda a entrada antes de gravar; bairros de outra cidade não são aceitos.
    for(const entry of input){
      if(!entry || typeof entry!=='object')throw new BadRequestException('Tarifa inválida.');
      const data=entry as Record<string,unknown>;
      const neighborhoodId=String(data.neighborhoodId||'');
      const n=allowed.get(neighborhoodId);
      if(!n || seen.has(neighborhoodId))throw new BadRequestException('Bairro duplicado ou não pertence à cidade.');
      seen.add(neighborhoodId);
      if(typeof data.enabled!=='boolean')throw new BadRequestException('Atendimento deve ser verdadeiro ou falso.');
      const deliveryFee=data.deliveryFee==null || data.deliveryFee==='' ? undefined : amount(data.deliveryFee);
      const motoboyFee=data.motoboyFee==null || data.motoboyFee==='' ? undefined : amount(data.motoboyFee);
      if(data.enabled && (!n.active || deliveryFee===undefined || motoboyFee===undefined))
        throw new BadRequestException(`Configure a taxa e o repasse de ${n.name} para ativar o atendimento.`);
      if(motoboyFee!==undefined && deliveryFee!==undefined && motoboyFee>deliveryFee)
        throw new BadRequestException(`Repasse maior que a taxa da entrega em ${n.name}.`);
      rows.push({neighborhoodId,enabled:data.enabled,deliveryFee,motoboyFee});
    }
    // Aceita envio parcial, preservando as demais tarifas desta loja.
    const merged=new Map((store.neighborhoodRates||[]).map(row=>[row.neighborhoodId,row]));
    for(const row of rows)merged.set(row.neighborhoodId,row);
    await this.users.updateOne({id:store.id},{$set:{neighborhoodRates:[...merged.values()],updatedAt:new Date()}});
    return this.getRates(cityId,storeId,user);
  }

  async pendingFees(cityId:string,user:UserRequest){
    this.ensureAdmin(user,cityId);
    await this.city(cityId);
    const deliveries=await this.deliveries.find({where:{
      'establishment.cityId':cityId,isActive:true,feeResolutionStatus:'PENDING',
    } as any,order:{createdAt:'DESC'},take:100});
    return deliveries.map(d=>({id:d.id,clientName:d.clientName,storeName:d.establishment?.name,
      addressNeighborhood:d.addressNeighborhood,status:d.status,createdAt:d.createdAt}));
  }
  async resolveFee(cityId:string,deliveryId:string,neighborhoodId:string,user:UserRequest){
    this.ensureAdmin(user,cityId);
    const city=await this.city(cityId);
    const delivery=await this.deliveries.findOne({where:{id:deliveryId}});
    if (!delivery||delivery.establishment?.cityId!==cityId) throw new NotFoundException('Entrega não encontrada nesta cidade.');
    if (delivery.feeResolutionStatus && delivery.feeResolutionStatus!=='PENDING') throw new BadRequestException('Entrega já possui tarifa registrada.');
    const neighborhood=(city.neighborhoods||[]).find(n=>n.id===neighborhoodId&&n.active);
    if (!neighborhood) throw new BadRequestException('Bairro inexistente ou inativo.');
    const store=await this.users.findOne({where:{id:delivery.establishment.id}});
    if (!store) throw new NotFoundException('Estabelecimento não encontrado.');
    const snapshot=this.calculate({...city,feeMode:'neighborhood'},store,neighborhood.name);
    if(snapshot.feeResolutionStatus==='PENDING') throw new BadRequestException('Configure taxa da entrega e repasse do motoboy para este estabelecimento antes de regularizar.');
    const result=await this.deliveries.updateOne({id:deliveryId,feeResolutionStatus:'PENDING'},
      {$set:{...snapshot,addressNeighborhood:neighborhood.name}});
    if (!result.modifiedCount) throw new BadRequestException('Tarifa alterada por outro administrador. Recarregue.');
    return {id:deliveryId,...snapshot};
  }

  calculate(city:CityEntity,store:UserEntity,neighborhoodName?:string):PricingSnapshot {
    if (city.feeMode!=='neighborhood'){
      const original=String(city.deliveryValue??'').replace(/R\$/gi,'').replace(/\s/g,'').trim();
      const numeric=Number(original.includes(',')?original.replace(/\./g,'').replace(',','.'):original);
      return {feeResolutionStatus:'FIXED',establishmentDeliveryCharge:amount(city.deliveryFeeValue??0),
        ...(original&&Number.isFinite(numeric)&&numeric>=0?{motoboyDeliveryFee:amount(numeric)}:{}),platformServiceFee:0};
    }
    const neighborhood=(city.neighborhoods||[]).find(n=>n.active &&
      [n.name,...(n.aliases||[])].some(name=>normalizedNeighborhood(name)===normalizedNeighborhood(neighborhoodName||'')));
    if(!neighborhood)return {feeResolutionStatus:'PENDING'};
    const rate=(store.neighborhoodRates||[]).find(r=>r.neighborhoodId===neighborhood.id && r.enabled===true);
    if(!rate || rate.deliveryFee===undefined || rate.deliveryFee===null ||
       rate.motoboyFee===undefined || rate.motoboyFee===null){
      return {feeResolutionStatus:'PENDING'};
    }
    const neighborhoodDeliveryFee=amount(rate.deliveryFee);
    const motoboyDeliveryFee=amount(rate.motoboyFee);
    if(motoboyDeliveryFee>neighborhoodDeliveryFee) return {feeResolutionStatus:'PENDING'};
    return {feeResolutionStatus:'RESOLVED',neighborhoodId:neighborhood.id,
      neighborhoodDeliveryFee,motoboyDeliveryFee,platformServiceFee:0,
      establishmentDeliveryCharge:neighborhoodDeliveryFee};
  }
}
