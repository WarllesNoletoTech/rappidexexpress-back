import { RankingService } from './ranking.service';
import { UserType } from '../shared/constants/enums.constants';

const CITY = '507f1f77bcf86cd799439011';
const admin = { id: 'admin1', cityId: CITY, type: UserType.ADMIN } as any;
const motoboy = { id: 'davi', cityId: CITY, type: UserType.MOTOBOY } as any;

function setup() {
  const stored: any[] = [];
  const matches = (item: any, where: any) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && '$exists' in value) {
      return (item[key] !== undefined) === (value as any).$exists;
    }
    return item[key] === value;
  });
  const points = {
    save: jest.fn(async (event: any) => { stored.push({ ...event }); return event; }),
    find: jest.fn(async ({ where }: any) => stored.filter(item => matches(item, where))),
    findOne: jest.fn(async ({ where }: any) => stored.find(item => matches(item, where))),
    updateOne: jest.fn(async (where: any, change: any) => {
      const entry = stored.find(item => matches(item, where));
      if (!entry) return { modifiedCount: 0 };
      Object.assign(entry, change.$set);
      return { modifiedCount: 1 };
    }),
  };
  const service = new RankingService(
    { findOne: jest.fn(async () => ({ id: CITY })) } as any,
    { findOne: jest.fn(async () => ({ id: motoboy.id, cityId: CITY, type: UserType.MOTOBOY, name: 'Davi' })) } as any,
    { findOne: jest.fn(async () => ({ id: 'r1', cityId: CITY, active: true, title: 'Comprometimento' })) } as any,
    points as any,
  );
  return { service, stored };
}

describe('Notificações individuais de avaliação', () => {
  it('cria aviso pendente, mostra ao motoboy e persiste a leitura', async () => {
    const { service } = setup();
    const award = await service.award(CITY, admin, { motoboyId: motoboy.id, ruleId: 'r1', points: 10, note: 'Parabéns' });
    expect((await service.unreadNotifications(motoboy))).toEqual([
      expect.objectContaining({ id: award.id, points: 10, ruleTitle: 'Comprometimento', note: 'Parabéns' }),
    ]);
    await service.acknowledgeNotification(motoboy, award.id);
    expect(await service.unreadNotifications(motoboy)).toEqual([]);
    await expect(service.acknowledgeNotification(motoboy, award.id)).resolves.toEqual({ success: true });
  });
  it('nunca entrega aviso a outra pessoa nem permite confirmar notificações alheias', async () => {
    const { service } = setup();
    const award = await service.award(CITY, admin, { motoboyId: motoboy.id, ruleId: 'r1', points: 5 });
    const another = { ...motoboy, id: 'outro' };
    expect(await service.unreadNotifications(another)).toEqual([]);
    await expect(service.acknowledgeNotification(another, award.id)).rejects.toThrow('Aviso nao encontrado.');
    await expect(service.unreadNotifications({ ...motoboy, type: UserType.SHOPKEEPER })).rejects.toThrow();
  });
  it('ignora avaliações antigas e avaliações estornadas antes da leitura', async () => {
    const { service, stored } = setup();
    stored.push({ id: 'antigo', cityId: CITY, motoboyId: motoboy.id, points: 20, awardedAt: new Date() });
    const award = await service.award(CITY, admin, { motoboyId: motoboy.id, ruleId: 'r1', points: 2 });
    expect((await service.unreadNotifications(motoboy)).map(item => item.id)).toEqual([award.id]);
    stored.find(item => item.id === award.id).reversedAt = new Date();
    expect(await service.unreadNotifications(motoboy)).toEqual([]);
  });
});
