import {
  BadRequestException, Injectable, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import { CityEntity } from '../database/entities/city.entity';
import { UserEntity } from '../database/entities/user.entity';
import { DeliveryEntity } from '../database/entities/delivery.entity';
import { UserRequest } from '../shared/interfaces';
import { UserType } from '../shared/constants/enums.constants';

export type Neighborhood = { id: string; name: string; active: boolean; motoboyFee?: number };
export type NeighborhoodRate = { neighborhoodId: string; enabled: boolean; deliveryFee: number };
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
  const numeric = typeof value === 'string'
    ? Number(value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value)
    : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || Math.abs(Math.round(numeric * 100) - numeric * 100) > 1e-6) {
    throw new BadRequestException('Valor monetário inválido (até duas casas decimais).');
  }
  return Math.round(numeric * 100) / 100;
}

@Injectable()
export class RegionsService {
  private readonly importCache = new Map<string, {expires: number; names: string[]}>();
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
      throw new UnauthorizedException('Apenas a administração pode alterar os bairros.');
    }
  }
  async list(cityId: string, user: UserRequest) {
    this.ensureCity(user, cityId);
    if (user.type === UserType.MOTOBOY) throw new UnauthorizedException('Apenas lojistas e administradores acessam tarifas.');
    const city = await this.city(cityId);
    return { cityId, feeMode: city.feeMode || 'fixed', platformServiceFee: city.platformServiceFee ?? 0, neighborhoods: city.neighborhoods || [] };
  }

  // Prévia pública opcional (OSM): nunca salva diretamente e não garante cobertura completa.
  async suggestions(cityId: string, user: UserRequest) {
    this.ensureAdmin(user, cityId);
    const city = await this.city(cityId);
    const cached = this.importCache.get(cityId);
    if (cached && cached.expires > Date.now()) return {source:'OpenStreetMap', names:cached.names, complete:false};
    try {
      const geocoding = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {q:`${city.name}, ${city.state || ''}, Brasil`,format:'jsonv2',limit:5,addressdetails:1},
        headers:{'User-Agent':'Rappidex-Operations/1.0 (admin neighborhood preview)'},timeout:12000,
      });
      const region = (geocoding.data as any[]).find((item:any)=>
        item.osm_type==='relation' &&
        (!item.address?.state_code || item.address.state_code===city.state));
      if (!region) return {source:'OpenStreetMap', names:[], complete:false, warning:'Limite municipal não localizado no OSM. Use o cadastro manual.'};
      const areaId = Number(region.osm_id)+3600000000;
      if (!Number.isSafeInteger(areaId)) throw new Error('Identificador municipal inválido.');
      const query = `[out:json][timeout:20];area(${areaId})->.searchArea;(node["place"~"^(neighbourhood|suburb|quarter)$"](area.searchArea);way["place"~"^(neighbourhood|suburb|quarter)$"](area.searchArea);relation["place"~"^(neighbourhood|suburb|quarter)$"](area.searchArea););out tags;`;
      const response = await axios.post('https://overpass.kumi.systems/api/interpreter',
        new URLSearchParams({data:query}).toString(),{
        headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Rappidex-Operations/1.0'},timeout:28000,
      });
      const imported: string[] = (response.data?.elements||[])
        .map((e:any)=>String(e.tags?.name||'').trim())
        .filter((name:string)=>name.length>1&&name.length<=110);
      const names = [...new Set<string>(imported)].sort((a,b)=>a.localeCompare(b,'pt-BR'));
      this.importCache.set(cityId,{expires:Date.now()+6*3600*1000,names});
      return {source:'OpenStreetMap',names,complete:false,warning:'Lista colaborativa. Confira com o cadastro municipal e acrescente bairros ausentes.'};
    } catch (_error) {
      return {source:'OpenStreetMap',names:[],complete:false,warning:'A consulta online não está disponível. É possível cadastrar ou colar uma lista manualmente.'};
    }
  }

  async addMany(cityId: string, user: UserRequest, names: unknown) {
    this.ensureAdmin(user, cityId);
    if (!Array.isArray(names) || names.length === 0 || names.length > 500) {
      throw new BadRequestException('Envie de 1 a 500 nomes de bairros.');
    }
    const city = await this.city(cityId);
    const current: Neighborhood[] = [...(city.neighborhoods || [])];
    const known = new Set(current.map(n => normalizedNeighborhood(n.name)));
    let added = 0;
    for (const raw of names) {
      if (typeof raw !== 'string') throw new BadRequestException('Nome de bairro inválido.');
      const name = raw.trim().replace(/\s+/g, ' ');
      const key = normalizedNeighborhood(name);
      if (!key || name.length > 110) throw new BadRequestException('Nome de bairro inválido.');
      if (!known.has(key)) { current.push({ id: uuid(), name, active: true }); known.add(key); added++; }
    }
    await this.cities.updateOne({ _id: city.id }, { $set: { neighborhoods: current } });
    return { added, neighborhoods: current };
  }
  async updateNeighborhood(cityId: string, id: string, user: UserRequest, payload: {name?: string; active?: boolean; motoboyFee?: number | null}) {
    this.ensureAdmin(user, cityId);
    const city = await this.city(cityId);
    const neighborhoods = [...(city.neighborhoods || [])];
    const target = neighborhoods.find(n => n.id === id);
    if (!target) throw new NotFoundException('Bairro não encontrado.');
    if (payload.name !== undefined) {
      const name = String(payload.name).trim();
      if (!name || name.length > 110 || neighborhoods.some(n => n.id !== id && normalizedNeighborhood(n.name) === normalizedNeighborhood(name))) {
        throw new BadRequestException('Nome inválido ou bairro duplicado.');
      }
      target.name = name;
    }
    if (payload.motoboyFee !== undefined) {
      // Campo vazio significa repasse não configurado; não calcular zero silenciosamente.
      if (payload.motoboyFee === null) delete target.motoboyFee;
      else target.motoboyFee = amount(payload.motoboyFee);
    }
    if (payload.active !== undefined) {
      if (typeof payload.active !== 'boolean') throw new BadRequestException('Situação inválida.');
      target.active = payload.active;
    }
    await this.cities.updateOne({ _id: city.id }, { $set: { neighborhoods } });
    return { neighborhoods };
  }
  async stores(cityId: string, user: UserRequest) {
    this.ensureAdmin(user, cityId);
    await this.city(cityId);
    const shops = await this.users.find({ where: { cityId, type: { $in: [UserType.SHOPKEEPER, UserType.SHOPKEEPERADMIN] } } as any });
    return shops.map(s => ({id: s.id, name: s.name, type: s.type }));
  }
  async store(cityId: string, storeId: string, user: UserRequest) {
    this.ensureCity(user, cityId);
    if (![UserType.ADMIN, UserType.SUPERADMIN].includes(user.type as UserType) && user.id !== storeId) {
      throw new UnauthorizedException('Sem permissão sobre esta loja.');
    }
    const store = await this.users.findOne({ where: { id: storeId } });
    if (!store || store.cityId !== cityId || ![UserType.SHOPKEEPER, UserType.SHOPKEEPERADMIN].includes(store.type as UserType)) {
      throw new NotFoundException('Loja não encontrada na cidade.');
    }
    return store;
  }
  async getRates(cityId: string, storeId: string, user: UserRequest) {
    const [store, city] = await Promise.all([this.store(cityId, storeId, user), this.city(cityId)]);
    const saved = new Map((store.neighborhoodRates || []).map(x => [x.neighborhoodId, x]));
    return {
      storeId, storeName: store.name, feeMode: city.feeMode || 'fixed',
      platformServiceFee: city.platformServiceFee ?? 0,
      rates: (city.neighborhoods || []).map(n => ({...n, enabled: n.active && Boolean(saved.get(n.id)?.enabled), deliveryFee: saved.get(n.id)?.deliveryFee ?? 0 })),
    };
  }
  async setRates(cityId: string, storeId: string, user: UserRequest, rates: unknown) {
    const [store, city] = await Promise.all([this.store(cityId, storeId, user), this.city(cityId)]);
    if (!Array.isArray(rates)) throw new BadRequestException('Lista de tarifas inválida.');
    const known = new Map((city.neighborhoods || []).map(n => [n.id, n]));
    const existing = new Map((store.neighborhoodRates || []).map(r => [r.neighborhoodId, r]));
    const checked = new Set<string>();
    for (const input of rates) {
      if (!input || typeof input.neighborhoodId !== 'string' || typeof input.enabled !== 'boolean') {
        throw new BadRequestException('Tarifa inválida.');
      }
      const neighborhood = known.get(input.neighborhoodId);
      if (!neighborhood || checked.has(input.neighborhoodId)) throw new BadRequestException('Bairro inexistente ou repetido.');
      if (input.enabled && !neighborhood.active) throw new BadRequestException('Bairro desativado pela administração.');
      checked.add(input.neighborhoodId);
      existing.set(input.neighborhoodId, {
        neighborhoodId: input.neighborhoodId,
        enabled: input.enabled,
        deliveryFee: amount(input.deliveryFee),
      });
    }
    const neighborhoodRates = [...existing.values()];
    await this.users.updateOne({ id: store.id }, { $set: { neighborhoodRates } });
    return this.getRates(cityId, storeId, user);
  }


  async pendingFees(cityId:string,user:UserRequest){
    this.ensureAdmin(user,cityId);
    await this.city(cityId);
    const deliveries=await this.deliveries.find({where:{
      'establishment.cityId':cityId,
      isActive:true,
      feeResolutionStatus:'PENDING',
    } as any,order:{createdAt:'DESC'},take:100});
    return deliveries.map(d=>({id:d.id,clientName:d.clientName,storeName:d.establishment?.name,
      addressNeighborhood:d.addressNeighborhood,status:d.status,createdAt:d.createdAt}));
  }
  async resolveFee(cityId:string,deliveryId:string,neighborhoodId:string,user:UserRequest){
    this.ensureAdmin(user,cityId);
    const city=await this.city(cityId);
    // Permitir regularizar pedidos históricos PENDING após a cidade voltar para taxa fixa.
    const delivery=await this.deliveries.findOne({where:{id:deliveryId}});
    if(!delivery || delivery.establishment?.cityId!==cityId) throw new NotFoundException('Entrega não encontrada nesta cidade.');
    if(delivery.feeResolutionStatus && delivery.feeResolutionStatus!=='PENDING') throw new BadRequestException('A entrega já possui uma tarifa registrada.');
    const neighborhood=(city.neighborhoods||[]).find(n=>n.id===neighborhoodId&&n.active);
    if(!neighborhood)throw new BadRequestException('Bairro inexistente ou inativo.');
    const store=await this.users.findOne({where:{id:delivery.establishment.id}});
    if(!store)throw new NotFoundException('Estabelecimento não encontrado.');
    // Preservar adicional congelado no momento do pedido, mesmo se a cidade mudou de modalidade.
    // Tarifa do motoboy só é contabilizada após preenchimento explícito do repasse.
    const snapshot=this.calculate({ ...city, feeMode:'neighborhood',
      platformServiceFee:delivery.platformServiceFee ?? city.platformServiceFee },store,neighborhood.name);
    if(snapshot.feeResolutionStatus==='PENDING')throw new BadRequestException('A loja não possui tarifa ativa para esse bairro.');
    const write = await this.deliveries.updateOne({id:deliveryId,feeResolutionStatus:'PENDING'},
      {$set:{...snapshot,addressNeighborhood:neighborhood.name}});
    if (!write.modifiedCount) throw new BadRequestException('A tarifa já foi alterada. Recarregue os pedidos pendentes.');
    return {id:deliveryId,...snapshot};
  }

  // Para pedidos externos sem bairro válido, não bloquear webhook/iFood: sinalizar PENDING
  // e impedir o fechamento indevido até que o pedido seja regularizado.
  calculate(city: CityEntity, store: UserEntity, neighborhoodName?: string): PricingSnapshot {
    if (city.feeMode !== 'neighborhood') {
      // Preserva a tarifa fixa legada. O valor do motoboy continua disponível
      // no cadastro da cidade e é congelado apenas quando for numérico.
      const original=String(city.deliveryValue??'').replace(/R\$/gi,'').replace(/\s/g,'').trim();
      const numeric=Number(original.includes(',')?original.replace(/\./g,'').replace(',','.'):original);
      return {feeResolutionStatus:'FIXED', establishmentDeliveryCharge: amount(city.deliveryFeeValue ?? 0),
        ...(original&&Number.isFinite(numeric)&&numeric>=0 ? {motoboyDeliveryFee:amount(numeric)} : {}),platformServiceFee:0};
    }
    const neighborhood = (city.neighborhoods || []).find(n => n.active && normalizedNeighborhood(n.name) === normalizedNeighborhood(neighborhoodName || ''));
    const config = (store.neighborhoodRates || []).find(r => r.neighborhoodId === neighborhood?.id && r.enabled);
    // Repasse é definido pela administração da cidade, não pela loja.
    // Sem repasse explícito não permitir um pedido novo financeiro incorreto.
    if (!neighborhood || !config || neighborhood.motoboyFee === undefined || neighborhood.motoboyFee === null) return {feeResolutionStatus:'PENDING',
      platformServiceFee:amount(city.platformServiceFee ?? 0)};
    const neighborhoodDeliveryFee = amount(config.deliveryFee);
    const motoboyDeliveryFee = amount(neighborhood.motoboyFee);
    const platformServiceFee = amount(city.platformServiceFee ?? 0);
    return {
      neighborhoodId: neighborhood.id,
      neighborhoodDeliveryFee,
      motoboyDeliveryFee,
      platformServiceFee,
      establishmentDeliveryCharge: Math.round((neighborhoodDeliveryFee + platformServiceFee) * 100) / 100,
      feeResolutionStatus:'RESOLVED',
    };
  }
}
