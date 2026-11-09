import {StatusDelivery} from '../shared/constants/enums.constants';
/** Repasse salvo na entrega, nunca delivery.value (taxa cobrada da loja). */
export function payoutInCents(d:{status?:string;feeResolutionStatus?:string;motoboyDeliveryFee?:number|null}):number|null{
 if(d.status!==StatusDelivery.FINISHED||d.feeResolutionStatus==='PENDING')return null;
 const val=d.motoboyDeliveryFee;
 if(typeof val!=='number'||!Number.isFinite(val)||val<=0)return null;
 const cents=Math.round(val*100);
 return Number.isSafeInteger(cents)&&cents<=100_000_000?cents:null;
}
/** finishedAt no Rappidex já é persistido com -3h; não descontar o fuso duas vezes. */
export function deliveryDay(finishedAt:Date|string){
 const d=new Date(finishedAt);if(Number.isNaN(d.valueOf()))throw new Error('Data inválida');
 return d.toISOString().slice(0,10);
}
