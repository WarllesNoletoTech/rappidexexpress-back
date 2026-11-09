import {CanActivate,ExecutionContext,Injectable,UnauthorizedException} from '@nestjs/common';
import {timingSafeEqual} from 'crypto';
@Injectable() export class MotoProGuard implements CanActivate{
 canActivate(context:ExecutionContext):boolean{
  const expected=String(process.env.MOTOPRO_INTEGRATION_SECRET||'');
  const header=String(context.switchToHttp().getRequest().headers.authorization||'');
  const received=/^Bearer (\S+)$/i.exec(header)?.[1]||'';
  const a=Buffer.from(expected),b=Buffer.from(received);
  if(expected.length<32||a.length!==b.length||!timingSafeEqual(a,b))throw new UnauthorizedException('Chave MotoPRO inválida');
  return true;
 }
}
