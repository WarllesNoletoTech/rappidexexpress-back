// QA isolado do resumo financeiro (sem acesso ao MongoDB de produção).
// Utiliza as próprias expressões de agregação do DeliveryService.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { AsyncFunction } = Object.getPrototypeOf(async function(){}).constructor ? {AsyncFunction: Object.getPrototypeOf(async function(){}).constructor} : {};
const src = fs.readFileSync(path.join(__dirname, '../src/delivery/delivery.service.ts'),'utf8');
const start = src.indexOf("      const bairroMode = city?.feeMode === 'neighborhood';");
const finish = src.indexOf("\n      return {\n        pending,", start);
assert.ok(start>=0 && finish>start,'Trecho de agregação financeira não encontrado.');
const calculation = src.slice(start, finish).replace('(value: number)', '(value)');
const extract = /private getFixedMotoboyFeeValue\(city: CityEntity \| null\): number \| null \{([\s\S]*?)\n  \}/.exec(src);
assert.ok(extract,'Conversor de repasse fixo não encontrado.');
const parseFixed = new Function('city',extract[1]);
assert.equal(parseFixed({deliveryValue:'R$ 1.234,50'}),1234.5);
assert.equal(parseFixed({deliveryValue:'7,00'}),7);
assert.equal(parseFixed({deliveryValue:'0'}),0);
assert.equal(parseFixed({deliveryValue:''}),null);

function evalMongo(expr,row) {
 if (typeof expr==='string') return expr.startsWith('$')?expr.substring(1).split('.').reduce((o,k)=>o?.[k],row):expr;
 if(expr===null || typeof expr!=='object' || expr instanceof Date) return expr;
 if(Array.isArray(expr)) return expr.map(x=>evalMongo(x,row));
 const ks=Object.keys(expr);
 assert.equal(ks.length,1,`Expressão inesperada: ${JSON.stringify(expr)}`);
 const key=ks[0]; const arg=expr[key];
 const ev=x=>evalMongo(x,row);
 switch(key){
 case '$literal':return arg;
 case '$ifNull': {const [x,y]=arg;const xv=ev(x);return xv===undefined||xv===null?ev(y):xv;}
 case '$cond': {const [c,t,f]=arg;return ev(c)?ev(t):ev(f);}
 case '$in': {const [a,arr]=arg;return ev(arr).includes(ev(a));}
 case '$eq': {const [a,b]=arg;return ev(a)===ev(b);}
 case '$ne': {const [a,b]=arg;return ev(a)!==ev(b);}
 case '$lt': {const [a,b]=arg;return ev(a)<ev(b);}
 case '$or': return arg.some(x=>Boolean(ev(x)));
 case '$and': return arg.every(x=>Boolean(ev(x)));
 case '$subtract': {const [a,b]=arg;return ev(a)-ev(b);}
 default: throw new Error(`Operador desconhecido: ${key}`);
 }
}
const financialFn = new AsyncFunction('city','adminFinancialWhere','totalEntregas',calculation+`\nreturn {
 valorAdminPorEntrega, totalValorAdmin:currencyRound(totalAReceber),
 totalReceitaPlataforma:currencyRound(totalAReceber-totalRepasseMotoboys),
 totalRepasseMotoboys:currencyRound(totalRepasseMotoboys),
 pendingFeeCount:Number(financialTotals[0]?.pending||0),
 pendingPayoutCount:Number(financialTotals[0]?.pendingPayout||0)
};`);
async function run(city,rows){
 const service = {
  getAdminDeliveryFeeValue:city=>Number(city?.deliveryFeeValue)||0,
  getFixedMotoboyFeeValue:parseFixed,
  deliveryRepository:{aggregate:(pipe)=>({toArray:async()=>{
    assert.ok(Array.isArray(pipe) && pipe.length===2);
    const group=pipe[1].$group;
    const result={};
    for(const [key,exp] of Object.entries(group)){
      if(key==='_id')continue;
      result[key]=rows.reduce((sum,row)=>sum+Number(evalMongo(exp.$sum,row)),0);
    }
    return rows.length?[result]:[];
  }})}
 };
 return financialFn.call(service, city,{},rows.length);
}
(async()=>{
 let n=0;
 const fixed={feeMode:'fixed',deliveryFeeValue:10,deliveryValue:'7,00'};
 const barrio={feeMode:'neighborhood',deliveryFeeValue:8,deliveryValue:'5,00',feeModeActivatedAt:new Date('2026-01-01')};
 const check=async(label,city,rows,expected)=>{const r=await run(city,rows);for(const [k,v] of Object.entries(expected))assert.equal(r[k],v,`${label}.${k}`);console.log('PASS',label);n++;};
 await check('fixa_snapshot',fixed,[{feeResolutionStatus:'FIXED',establishmentDeliveryCharge:10,motoboyDeliveryFee:7},{feeResolutionStatus:'FIXED',establishmentDeliveryCharge:9,motoboyDeliveryFee:6}],{totalValorAdmin:19,totalRepasseMotoboys:13,totalReceitaPlataforma:6,pendingPayoutCount:0});
 await check('fixa_legado_sem_snapshot',fixed,[{},{}],{totalValorAdmin:20,totalRepasseMotoboys:14,totalReceitaPlataforma:6,pendingFeeCount:0,pendingPayoutCount:0});
 await check('fixa_snapshot_antigo_sem_repasse',fixed,[{feeResolutionStatus:'FIXED',establishmentDeliveryCharge:9}],{totalValorAdmin:9,totalRepasseMotoboys:7,totalReceitaPlataforma:2,pendingPayoutCount:0});
 await check('bairro_snapshots_individuais',barrio,[{feeResolutionStatus:'RESOLVED',establishmentDeliveryCharge:12,motoboyDeliveryFee:9},{feeResolutionStatus:'RESOLVED',establishmentDeliveryCharge:14,motoboyDeliveryFee:10}],{totalValorAdmin:26,totalRepasseMotoboys:19,totalReceitaPlataforma:7,pendingPayoutCount:0});
 await check('bairro_pendente',barrio,[{feeResolutionStatus:'PENDING',createdAt:new Date('2026-10-11')},{feeResolutionStatus:'RESOLVED',establishmentDeliveryCharge:14,motoboyDeliveryFee:10}],{totalValorAdmin:14,totalRepasseMotoboys:10,totalReceitaPlataforma:4,pendingFeeCount:1,pendingPayoutCount:0});
 await check('bairro_legado_anterior_mudanca',barrio,[{createdAt:new Date('2025-12-31')},{feeResolutionStatus:'RESOLVED',createdAt:new Date('2026-06-01'),establishmentDeliveryCharge:12,motoboyDeliveryFee:9}],{totalValorAdmin:20,totalRepasseMotoboys:14,totalReceitaPlataforma:6});
 await check('bairro_snapshot_incompleto',barrio,[{feeResolutionStatus:'RESOLVED',establishmentDeliveryCharge:12}],{totalValorAdmin:12,totalRepasseMotoboys:0,totalReceitaPlataforma:12,pendingPayoutCount:1});
 await check('fixa_sem_valor_motoboy', {...fixed,deliveryValue:''},[{}],{totalValorAdmin:10,totalRepasseMotoboys:0,totalReceitaPlataforma:10,pendingPayoutCount:1});
 await check('troca_bairro_para_fixa_nao_herda_valor',fixed,[{feeResolutionStatus:'RESOLVED',establishmentDeliveryCharge:11}],{totalValorAdmin:11,totalRepasseMotoboys:0,totalReceitaPlataforma:11,pendingPayoutCount:1});
 await check('snapshot_preserva_tarifas', {...fixed,deliveryFeeValue:50,deliveryValue:'30'},[{feeResolutionStatus:'FIXED',establishmentDeliveryCharge:10,motoboyDeliveryFee:7}],{totalValorAdmin:10,totalRepasseMotoboys:7,totalReceitaPlataforma:3});
 const front=fs.readFileSync(path.join(__dirname,'../../rappidexexpress-front/src/pages/Dashboard/index.tsx'),'utf8');
 const begin=front.indexOf('{isAdminDashboardUser && (');
 const end=front.indexOf('</AdminFinancialCard>',begin);
 const block=front.slice(begin,end);
 assert.ok(['Valor a receber','Repasse aos motoboys','Saldo da administração'].every(t=>block.includes(t)));
 assert.ok(!block.includes('<span>Entregas da cidade</span>') && !block.includes('<span>Cidade</span>'));
 assert.ok(block.includes('pendingPayoutCount'));
 console.log('PASS painel_com_tres_indicadores_e_alertas');n++;
 console.log(`${n} testes de regressão do resumo financeiro aprovados.`);
})().catch(e=>{console.error(e);process.exitCode=1});
