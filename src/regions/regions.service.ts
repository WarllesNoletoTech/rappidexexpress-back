import {
  BadRequestException, Injectable, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import { buildOsmQuery, chooseMunicipality, extractNeighborhoodNames, stateNameFromCode } from './neighborhood-import';
import { CityEntity } from '../database/entities/city.entity';
import { UserEntity } from '../database/entities/user.entity';
import { DeliveryEntity } from '../database/entities/delivery.entity';
import { UserRequest } from '../shared/interfaces';
import { UserType } from '../shared/constants/enums.constants';

export type Neighborhood = { id: string; name: string; active: boolean; motoboyFee?: number; aliases?: string[] };
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
  private readonly importCache = new Map<string, {expires: number; names: string[]; warning: string}>();
  private readonly autoImportInProgress = new Map<string, Promise<any>>();
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

  // Consulta exclusivamente no backend para preservar as regras de uso da fonte OSM.
  // Resultados são parciais: bairros ausentes continuam disponíveis para cadastro manual.
  async suggestions(cityId: string, user: UserRequest) {
    this.ensureAdmin(user, cityId);
    const city = await this.city(cityId);
    const cached = this.importCache.get(cityId);
    if (cached && cached.expires > Date.now()) {
      return { source: 'OpenStreetMap', names: cached.names, complete: false, warning: cached.warning };
    }
    const source = 'OpenStreetMap';
    const warning = 'Os dados do OpenStreetMap podem estar incompletos. Confira os bairros, edite os nomes e inclua os que faltarem.';
    try {
      const geocoding = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: `${city.name}, ${stateNameFromCode(city.state || '')}, Brasil`, format: 'jsonv2', limit: 8,
          addressdetails: 1, countrycodes: 'br' },
        headers: { 'User-Agent': 'RappidexExpress-Server/1.0 (neighborhood admin importer)', 'Accept-Language': 'pt-BR' },
        timeout: 6500,
      });
      const region = chooseMunicipality(geocoding.data, city.name, city.state || '');
      if (!region) {
        const warn = 'Não foi possível localizar com segurança o limite municipal. Cadastre os bairros manualmente ou tente novamente mais tarde.';
        this.importCache.set(cityId, { expires: Date.now() + 10 * 60_000, names: [], warning: warn });
        return {source, names: [], complete: false, warning: warn};
      }
      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
      ];
      // Se a área municipal não existir no Overpass, tenta o retângulo do
      // município geocodificado. Nenhum dos dois métodos garante 100% de cobertura.
      let names: string[] = [];
      let hadSuccess = false;
      for (const mode of ['area', 'bbox'] as const) {
        if (mode === 'area' && region.osm_type !== 'relation') continue;
        const query = buildOsmQuery(region, mode);
        if (!query) continue;
        // Os espelhos respondem em paralelo para não exceder o timeout HTTP
        // do Heroku (30s). O primeiro resultado com bairros é utilizado.
        const attempts = endpoints.map(async endpoint => {
          const response = await axios.post(endpoint, new URLSearchParams({data: query}).toString(), {
            headers: {'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'RappidexExpress-Server/1.0'},
            timeout: 10000, maxContentLength: 5_000_000,
          });
          hadSuccess = true;
          const found = extractNeighborhoodNames(response.data?.elements, city.name);
          if (!found.length) throw new Error('Sem bairros mapeados nesta fonte.');
          return found;
        });
        try { names = await Promise.any(attempts); }
        catch (_error) { /* Tenta o modo bbox, se a consulta de área não encontrou bairros. */ }
        if (names.length) break;
      }
      const resultWarning = names.length ? warning : hadSuccess
        ? 'A consulta foi concluída, mas não encontrou bairros mapeados nessa cidade. Você pode cadastrá-los manualmente.'
        : 'Os serviços de mapas não responderam. É possível cadastrar manualmente e tentar sincronizar novamente.';
      this.importCache.set(cityId, { expires: Date.now() + (names.length ? 6 * 3600_000 : 10 * 60_000), names, warning: resultWarning });
      return {source, names, complete: false, warning: resultWarning};
    } catch (_error) {
      const warn = 'A consulta online não está disponível. É possível cadastrar bairros manualmente ou sincronizar depois.';
      this.importCache.set(cityId, {expires: Date.now() + 10 * 60_000, names: [], warning: warn});
      return {source, names: [], complete: false, warning: warn};
    }
  }

  // Importação aditiva: nunca substitui nomes editados, IDs, bairros desativados,
  // repasses ou tarifas próprias dos estabelecimentos.
  async autoImport(cityId: string, user: UserRequest) {
    this.ensureAdmin(user, cityId);
    const inProgress = this.autoImportInProgress.get(cityId);
    if (inProgress) return inProgress;
    const task = (async () => {
      const suggested = await this.suggestions(cityId, user);
      if (!suggested.names.length) {
        const city = await this.city(cityId);
        return { source: suggested.source, complete: false, totalFound: 0,
          added: 0, neighborhoods: city.neighborhoods || [], warning: suggested.warning };
      }
      const imported = await this.addMany(cityId, user, suggested.names.slice(0, 500));
      return { ...imported, source: suggested.source, totalFound: suggested.names.length,
        complete: false, warning: suggested.warning };
    })();
    this.autoImportInProgress.set(cityId, task);
    try { return await task; }
    finally { if (this.autoImportInProgress.get(cityId) === task) this.autoImportInProgress.delete(cityId); }
  }

  async addMany(cityId: string, user: UserRequest, names: unknown) {
    this.ensureAdmin(user, cityId);
    if (!Array.isArray(names) || names.length === 0 || names.length > 500) {
      throw new BadRequestException('Envie de 1 a 500 nomes de bairros.');
    }
    const city = await this.city(cityId);
    const current: Neighborhood[] = [...(city.neighborhoods || [])];
    const known = new Set(current.flatMap(n => [n.name, ...(n.aliases || [])].map(normalizedNeighborhood)));
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
      if (!name || name.length > 110 || neighborhoods.some(n => n.id !== id &&
          [n.name, ...(n.aliases || [])].some(previous => normalizedNeighborhood(previous) === normalizedNeighborhood(name)))) {
        throw new BadRequestException('Nome inválido ou bairro duplicado.');
      }
      // Mantém nomes anteriores para que sincronizações futuras não recriem
      // bairros renomeados pelo administrador.
      if (normalizedNeighborhood(target.name) !== normalizedNeighborhood(name)) {
        target.aliases = [...(target.aliases || []), target.name].slice(-30);
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
