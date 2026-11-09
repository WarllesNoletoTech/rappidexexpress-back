import {payoutInCents,deliveryDay} from './payout';
import {StatusDelivery} from '../shared/constants/enums.constants';
describe('Repasse para MotoPRO',()=>{
 it('puxa repasse, não taxa da loja',()=>expect(payoutInCents({status:StatusDelivery.FINISHED,motoboyDeliveryFee:7.50})).toBe(750));
 it('não importa cancelados ou indefinidos',()=>{
  expect(payoutInCents({status:StatusDelivery.CANCELED,motoboyDeliveryFee:7.50})).toBeNull();
  expect(payoutInCents({status:StatusDelivery.FINISHED})).toBeNull();
  expect(payoutInCents({status:StatusDelivery.FINISHED,feeResolutionStatus:'PENDING',motoboyDeliveryFee:7.50})).toBeNull();
 });
 it('não desloca dia do timestamp legado',()=>expect(deliveryDay('2026-11-10T01:30:00Z')).toBe('2026-11-10'));
});
