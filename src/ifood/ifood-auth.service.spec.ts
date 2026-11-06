import { createHmac } from 'crypto';
import { IfoodAuthService } from './ifood-auth.service';

describe('IfoodAuthService - validação HMAC do webhook', () => {
  const payload = Buffer.from('{"id":"evento-1","code":"CON"}', 'utf8');
  const secret = 'segredo-teste';
  const signature = createHmac('sha256', secret).update(payload).digest('hex');

  it('aceita assinatura válida dos bytes originais', () => {
    const service = new IfoodAuthService(
      { get: jest.fn((key) => key === 'IFOOD_CLIENT_SECRET' ? secret : undefined) } as any,
      {} as any,
    );
    expect(service.verifyWebhookSignature(payload, signature)).toBe(true);
  });

  it('bloqueia alteração de payload ou ausência de assinatura', () => {
    const service = new IfoodAuthService(
      { get: jest.fn((key) => key === 'IFOOD_CLIENT_SECRET' ? secret : undefined) } as any,
      {} as any,
    );
    expect(service.verifyWebhookSignature(Buffer.from('{"id":"evento-2","code":"CON"}'), signature)).toBe(false);
    expect(service.verifyWebhookSignature(payload, undefined)).toBe(false);
  });

  it('falha fechado sem credenciais configuradas', () => {
    const service = new IfoodAuthService(
      { get: jest.fn().mockReturnValue(undefined) } as any,
      {} as any,
    );
    expect(service.verifyWebhookSignature(payload, signature)).toBe(false);
  });
});
