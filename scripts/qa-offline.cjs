/**
 * Regressão de serviços offline, sem banco e sem rede.
 * Requer TypeScript instalado (npm ci); permite NODE_PATH com TypeScript global.
 * Roda Node 22: node scripts/qa-offline.cjs
 * Não substitui npm run build, Jest nem testes end-to-end.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const originalLoad = Module._load;
const originalTs = Module._extensions['.ts'];
const deco = () => () => {};
class HttpError extends Error { constructor(message){super(message);this.name=this.constructor.name;} }
class BadRequestException extends HttpError{}
class UnauthorizedException extends HttpError{}
class NotFoundException extends HttpError{}
class ObjectId {
  constructor(value = 'aaaaaaaaaaaaaaaaaaaaaaaa') {this.value=String(value);}
  toString(){return this.value;}
  toHexString(){return this.value;}
  static isValid(value){return typeof value==='string' && /^[a-f0-9]{24}$/i.test(value);}
}
let generated=0;
const mocks={
  '@nestjs/common': {BadRequestException,UnauthorizedException,NotFoundException,
    Injectable:deco, Logger:class {log(){} error(){} warn(){}}, Module:deco},
  '@nestjs/typeorm': {InjectRepository:deco},
  'typeorm': new Proxy({}, {get:()=>deco}),
  'mongodb': {ObjectId},
  'uuid': {v4:()=>`qa-id-${++generated}`},
  'axios': {get: async()=>{throw new Error('Rede desabilitada nos testes');}},
  'class-validator':new Proxy({}, {get:()=>deco}),
  'class-transformer':new Proxy({}, {get:()=>deco}),
};
Module._load=function(request,parent,isMain){
  if(Object.hasOwn(mocks,request)) return mocks[request];
  return originalLoad.call(this,request,parent,isMain);
};
Module._extensions['.ts']=function(m,filename){
  const source=fs.readFileSync(filename,'utf8');
  const transpiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,
    experimentalDecorators:true,emitDecoratorMetadata:false,esModuleInterop:true}});
  m._compile(transpiled.outputText,filename);
};
const ROOT=path.resolve(__dirname,'../src');
const {RegionsService,amount,normalizedNeighborhood}=require(path.join(ROOT,'regions/regions.service.ts'));
const {RankingService,parseRankingWeek,weekStartBelem}=require(path.join(ROOT,'ranking/ranking.service.ts'));
const {FinancialSettlementService}=require(path.join(ROOT,'financial-settlement/financial-settlement.service.ts'));
const {CityService}=require(path.join(ROOT,'city/city.service.ts'));
const {UserType,StatusDelivery}=require(path.join(ROOT,'shared/constants/enums.constants.ts'));
const CITY_ID='aaaaaaaaaaaaaaaaaaaaaaaa', OTHER_CITY_ID='bbbbbbbbbbbbbbbbbbbbbbbb';
const city={id:new ObjectId(CITY_ID),name:'Imperatriz',state:'MA',feeMode:'neighborhood',
    platformServiceFee:3,deliveryFeeValue:10,pixKey:'pix-cidade-teste', feeModeActivatedAt:new Date('2026-11-01T00:00:00.000Z'),
    neighborhoods:[{id:'b1',name:'Bacuri',active:true,motoboyFee:6},{id:'b2',name:'Vila Lobão',active:false}]};
const store={id:'loja-1',name:'Ponto Burguer',cityId:CITY_ID,type:UserType.SHOPKEEPER,
    neighborhoodRates:[{neighborhoodId:'b1',enabled:true,deliveryFee:8}]};
const driver={id:'motoboy-1',name:'Davi',cityId:CITY_ID,type:UserType.MOTOBOY,isActive:true};
const admin={id:'admin-1',type:UserType.ADMIN,cityId:CITY_ID};
const adminOther={id:'admin-2',type:UserType.ADMIN,cityId:OTHER_CITY_ID};
const repoCities={findOne:async({where})=>String(where?._id)===CITY_ID?city:null,updateOne:async()=>({modifiedCount:1})};
let deliveryRow={id:'delivery-1',feeResolutionStatus:'PENDING',addressNeighborhood:'',establishment:{id:store.id,cityId:CITY_ID}};
const repoUsers={findOne:async({where})=>[store,driver].find(u=>Object.entries(where||{}).every(([k,v])=>u[k]===v))||null,
    updateOne:async(_filter,operation)=>{store.neighborhoodRates=operation.$set.neighborhoodRates;return {modifiedCount:1}}};
const repoDeliveries={findOne:async({where})=>where.id===deliveryRow.id?deliveryRow:null,
    updateOne:async(filter,operation)=>{if(filter.feeResolutionStatus!==deliveryRow.feeResolutionStatus)return {modifiedCount:0};Object.assign(deliveryRow,operation.$set);return {modifiedCount:1}}};
const regions=new RegionsService(repoCities,repoUsers,repoDeliveries);

test('Normalização e centavos brasileiros (Bacuri / Vila Lobão)',()=>{
  assert.equal(normalizedNeighborhood(' Vila-Lobão '),normalizedNeighborhood('vila lobao'));
  assert.equal(amount('8,99'),8.99);assert.equal(amount(0.29),0.29);
  assert.throws(()=>amount('8,999'),BadRequestException);
  assert.throws(()=>amount(-1),BadRequestException);
});
test('Tarifa por bairro = valor da loja + adicional Rappidex, mantendo snapshot',()=>{
  const result=regions.calculate(city,store,'bacuri');
  assert.equal(result.neighborhoodDeliveryFee,8);assert.equal(result.motoboyDeliveryFee,6);assert.equal(result.platformServiceFee,3);
  assert.equal(result.establishmentDeliveryCharge,11);assert.equal(result.feeResolutionStatus,'RESOLVED');
  assert.equal(regions.calculate(city,store,'Vila Lobão').feeResolutionStatus,'PENDING');
  assert.equal(regions.calculate(city,store,'bairro desconhecido').feeResolutionStatus,'PENDING');
  assert.equal(regions.calculate({...city,feeMode:'fixed'},store,'').establishmentDeliveryCharge,10);
});
test('Cidade errada não acessa cadastro de bairros nem modifica loja',async()=>{
  await assert.rejects(regions.list(CITY_ID,adminOther),UnauthorizedException);
  await assert.rejects(regions.setRates(CITY_ID,store.id,adminOther,[]),UnauthorizedException);
  await assert.rejects(regions.getRates(CITY_ID,store.id,{id:'outra-loja',type:UserType.SHOPKEEPER,cityId:CITY_ID}),UnauthorizedException);
});
test('Não permite ativar bairro desligado pelo administrador',async()=>{
  await assert.rejects(regions.setRates(CITY_ID,store.id,admin,[{neighborhoodId:'b2',enabled:true,deliveryFee:7}]),BadRequestException);
  await assert.rejects(regions.setRates(CITY_ID,store.id,admin,[{neighborhoodId:'b1',enabled:true,deliveryFee:7.999}]),BadRequestException);
});
test('Regularização só grava PENDING e preserva snapshots já tarifados',async()=>{
  const result=await regions.resolveFee(CITY_ID,'delivery-1','b1',admin);
  assert.equal(result.establishmentDeliveryCharge,11);
  assert.equal(deliveryRow.feeResolutionStatus,'RESOLVED');
  await assert.rejects(regions.resolveFee(CITY_ID,'delivery-1','b1',admin),BadRequestException);
});

const pointRows=[];const ruleRows=[];
const ruleRepo={
  count:async({where})=>ruleRows.filter(r=>r.cityId===where.cityId).length,
  find:async({where})=>ruleRows.filter(r=>r.cityId===where.cityId).sort((a,b)=>a.order-b.order),
  findOne:async({where})=>ruleRows.find(r=>Object.entries(where).every(([k,v])=>r[k]===v))||null,
  updateOne:async(filter,operation,opts={})=>{
    let r=ruleRows.find(x=>Object.entries(filter).every(([k,v])=>x[k]===v));
    if(!r && opts.upsert){r={...operation.$setOnInsert};ruleRows.push(r);return {modifiedCount:1};}
    if(r){Object.assign(r,operation.$set||{});return {modifiedCount:1};}
    return {modifiedCount:0};
  },
  save:async(data)=>{ruleRows.push(data);return data}
};
const pointRepo={
  save:async(data)=>{pointRows.push(data);return data;},
  findOne:async({where})=>pointRows.find(p=>p.id===where.id&&p.cityId===where.cityId)||null,
  find:async({where})=>pointRows.filter(p=>p.cityId===where.cityId&&p.weekStart>=where.weekStart.$gte&&p.weekStart<where.weekStart.$lt),
  updateOne:async(filter,op)=>{
    const p=pointRows.find(p=>p.id===filter.id && p.cityId===filter.cityId && !p.reversedAt);
    if(!p)return {modifiedCount:0}; Object.assign(p,op.$set);return {modifiedCount:1};
  }
};
const ranking=new RankingService(repoCities, {findOne:repoUsers.findOne, find:async()=>[driver]},ruleRepo,pointRepo);
test('Semana terça 00:00 até segunda 23:59:59 em Belém',()=>{
  assert.equal(weekStartBelem(new Date('2026-11-10T02:59:59Z')).toISOString(),'2026-11-03T03:00:00.000Z');
  assert.equal(weekStartBelem(new Date('2026-11-10T03:00:00Z')).toISOString(),'2026-11-10T03:00:00.000Z');
  assert.equal(parseRankingWeek('2026-11-03').toISOString(),'2026-11-03T03:00:00.000Z');
  assert.throws(()=>parseRankingWeek('2026-11-11'),BadRequestException);
});
test('As dez regras iniciais são criadas uma vez e podem ser editadas',async()=>{
  const rules=await ranking.listRules(CITY_ID,admin);
  assert.equal(rules.length,10);
  await ranking.listRules(CITY_ID,admin);assert.equal(ruleRows.length,10);
  await ranking.updateRule(CITY_ID,rules[0].id,admin,{title:'Comprometimento no fim de semana'});
  assert.equal(ruleRows[0].title,'Comprometimento no fim de semana');
  await assert.rejects(ranking.updateRule(CITY_ID,rules[0].id,adminOther,{title:'a'}),UnauthorizedException);
});
test('Pontuação manual, Top 5 e estorno com registro',async()=>{
  const event=await ranking.award(CITY_ID,admin,{motoboyId:driver.id,ruleId:ruleRows[0].id,points:10,note:'Boa avaliação'});
  assert.equal(event.ruleTitleSnapshot,'Comprometimento no fim de semana');
  assert.equal((await ranking.leaderboard(CITY_ID,admin)).top5[0].points,10);
  assert.equal((await ranking.leaderboard(CITY_ID,driver)).top5.length,1);
  await ranking.reverse(CITY_ID,event.id,admin);
  assert.ok(event.reversedAt); assert.equal((await ranking.leaderboard(CITY_ID,admin)).top5.length,0);
  await assert.rejects(ranking.reverse(CITY_ID,event.id,admin),BadRequestException);
});

test('Fechamento: soma cada snapshot de entrega, sem tarifa fixa duplicada',async()=>{
  const rows=[
    {id:'d1',clientName:'A',status:StatusDelivery.FINISHED,establishment:{id:store.id},createdAt:new Date('2026-11-05T12:00:00Z'),feeResolutionStatus:'RESOLVED',establishmentDeliveryCharge:11},
    {id:'d2',clientName:'B',status:StatusDelivery.FINISHED,establishment:{id:store.id},createdAt:new Date('2026-11-06T12:00:00Z'),feeResolutionStatus:'RESOLVED',establishmentDeliveryCharge:13},
  ];
  const settlement=new FinancialSettlementService(
    {find:async()=>rows},
    {findOneBy:async({id})=>id===store.id?{...store,managerWhatsapp:'5594999999999'}:null},
    repoCities,
    {save:async()=>({})}
  );
  const query={establishmentId:store.id,createdIn:'2026-11-03',createdUntil:'2026-11-09'};
  const result=await settlement.buildSettlement(query);
  assert.equal(result.totalDeliveries,24);
  assert.equal(result.deliveries[0].charge,11);
  assert.equal(result.deliveries[1].charge,13);
  rows.push({id:'d3',clientName:'C',status:StatusDelivery.FINISHED,establishment:{id:store.id},createdAt:new Date('2026-11-06T15:00:00Z'),feeResolutionStatus:'PENDING'});
  await assert.rejects(settlement.buildSettlement(query),BadRequestException);
});


test('Troca de taxa fixa para bairro redefine o marco temporal; centavos inválidos são rejeitados',async()=>{
  let saved={...city,feeMode:'fixed',feeModeActivatedAt:new Date('2025-01-01T00:00:00.000Z')};
  const repository={findOne:async()=>saved,save:async update=>(saved=update)};
  const service=new CityService(repository);
  await assert.rejects(service.updateCity(CITY_ID,{platformServiceFee:3.333},admin),UnauthorizedException);
  await service.updateCity(CITY_ID,{feeMode:'neighborhood',platformServiceFee:3},admin);
  assert.equal(saved.feeMode,'neighborhood');
  assert.equal(saved.platformServiceFee,3);
  assert.ok(saved.feeModeActivatedAt.getTime()>Date.parse('2025-01-01T00:00:00Z'));
  const switchedAt=saved.feeModeActivatedAt;
  await service.updateCity(CITY_ID,{platformServiceFee:4},admin);
  assert.equal(saved.feeModeActivatedAt,switchedAt);
  await service.updateCity(CITY_ID,{feeMode:'fixed'},admin);
  await service.updateCity(CITY_ID,{feeMode:'neighborhood'},admin);
  assert.notEqual(saved.feeModeActivatedAt,switchedAt);
});

test('Fechamento preserva tarifa fixa anterior à mudança de modalidade',async()=>{
  const previous=new Date('2026-10-01T00:00:00Z');
  const old=[{id:'legacy',clientName:'A',status:StatusDelivery.FINISHED,establishment:{id:store.id},createdAt:previous}];
  const service=new FinancialSettlementService(
    {find:async()=>old},{findOneBy:async()=>({...store,managerWhatsapp:'5594999999999'})},repoCities,{save:async()=>({})}
  );
  const result=await service.buildSettlement({establishmentId:store.id,createdIn:'2026-09-30',createdUntil:'2026-11-03'});
  assert.equal(result.totalDeliveries,10);
});

test('Top 5 público não revela colocação dos demais; detalhes são restritos a admin',async()=>{
  const weekStart=weekStartBelem();
  for(let i=0;i<6;i++){
    pointRows.push({id:`rank-qa-${i}`,cityId:CITY_ID,motoboyId:`outro-${i}`,motoboyName:`Teste ${i}`,
      ruleId:ruleRows[0].id,ruleTitleSnapshot:ruleRows[0].title,points:i+1,
      awardedAt:new Date(),weekStart});
  }
  const publicBoard=await ranking.leaderboard(CITY_ID,driver,undefined,true);
  const adminBoard=await ranking.leaderboard(CITY_ID,admin,undefined,true);
  assert.equal(publicBoard.top5.length,5);
  assert.equal(publicBoard.all,undefined);
  assert.equal(adminBoard.all.length,6);
  assert.equal(publicBoard.top5[0].points,6);
});

test('Lista central de bairros não duplica nomes por acentos e pontuação',async()=>{
  const old=city.neighborhoods;
  const write=repoCities.updateOne;
  repoCities.updateOne=async (_filter,operation)=>{city.neighborhoods=operation.$set.neighborhoods;return {modifiedCount:1};};
  try{
    const result=await regions.addMany(CITY_ID,admin,['Bacuri','BA CURI','Novo Bairro','novo-bairro']);
    assert.equal(result.added,2);
    assert.ok(result.neighborhoods.some(n=>n.name==='Novo Bairro'));
  }finally{city.neighborhoods=old;repoCities.updateOne=write;}
});

test('Pedidos PENDING continuam bloqueando o fechamento após retornar a taxa fixa',async()=>{
  const oldMode=city.feeMode;
  city.feeMode='fixed';
  const row=[{id:'x-pending',clientName:'A',status:StatusDelivery.FINISHED,
    establishment:{id:store.id},createdAt:new Date('2026-11-05T12:00:00Z'),feeResolutionStatus:'PENDING',platformServiceFee:3}];
  const settlement=new FinancialSettlementService(
    {find:async()=>row},{findOneBy:async()=>({...store,managerWhatsapp:'5594999999999'})},repoCities,{save:async()=>({})}
  );
  try{await assert.rejects(settlement.buildSettlement({establishmentId:store.id,createdIn:'2026-11-03',createdUntil:'2026-11-09'}),BadRequestException);}
  finally{city.feeMode=oldMode;}
});

test('Regularização após mudança para taxa fixa mantém adicional original do pedido',async()=>{
  const oldMode=city.feeMode,oldFee=city.platformServiceFee;
  const originalDelivery=deliveryRow;
  city.feeMode='fixed';city.platformServiceFee=4;
  deliveryRow={id:'delivery-old-pending',feeResolutionStatus:'PENDING',platformServiceFee:3,
    establishment:{id:store.id,cityId:CITY_ID}};
  try{
    const snapshot=await regions.resolveFee(CITY_ID,deliveryRow.id,'b1',admin);
    assert.equal(snapshot.platformServiceFee,3);
    assert.equal(snapshot.establishmentDeliveryCharge,11);
  }finally{city.feeMode=oldMode;city.platformServiceFee=oldFee;deliveryRow=originalDelivery;}
});

test('Repasse por bairro editável somente pela administração; ausência bloqueia nova tarifação',async()=>{
  const previous=city.neighborhoods[0].motoboyFee;
  const originalUpdate=repoCities.updateOne;
  repoCities.updateOne=async(_filter,operation)=>{city.neighborhoods=operation.$set.neighborhoods;return {modifiedCount:1};};
  try{
    await assert.rejects(regions.updateNeighborhood(CITY_ID,'b1',{id:store.id,type:UserType.SHOPKEEPER,cityId:CITY_ID},{motoboyFee:9}),UnauthorizedException);
    await regions.updateNeighborhood(CITY_ID,'b1',admin,{motoboyFee:7.5});
    assert.equal(regions.calculate(city,store,'Bacuri').motoboyDeliveryFee,7.5);
    await regions.updateNeighborhood(CITY_ID,'b1',admin,{motoboyFee:null});
    assert.equal(regions.calculate(city,store,'Bacuri').feeResolutionStatus,'PENDING');
    await assert.rejects(regions.updateNeighborhood(CITY_ID,'b1',admin,{motoboyFee:-1}),BadRequestException);
  }finally{city.neighborhoods[0].motoboyFee=previous;repoCities.updateOne=originalUpdate;}
});
test('Valor do motoboy preservado quando a tabela de taxas muda',()=>{
  const initial=regions.calculate(city,store,'Bacuri');
  city.neighborhoods[0].motoboyFee=20;
  const newer=regions.calculate(city,store,'Bacuri');
  assert.equal(initial.motoboyDeliveryFee,6);
  assert.equal(newer.motoboyDeliveryFee,20);
  city.neighborhoods[0].motoboyFee=6;
});
