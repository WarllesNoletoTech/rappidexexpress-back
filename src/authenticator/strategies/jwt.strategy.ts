import { PostgresCompatRepository } from '../../database/postgres-compat.repository';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../../database/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepository: PostgresCompatRepository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,
      secretOrKey: configService.get<string>('JWT_SECRET_KEY'),
    });
  }

  async validate(payload: any) {
    const { id, user, type, phone, permission, cityId } = payload;
    const currentUser = await this.userRepository.findOneBy({ id });

    if (!currentUser) {
      throw new ForbiddenException('Usuário não encontrado.');
    }

    if (currentUser.blocked) {
      throw new ForbiddenException(
        'Usuário bloqueado. Procure o administrador.',
      );
    }

    // A autorização já fez uma leitura da linha atual. Use os atributos atuais
    // do banco (e não os possivelmente antigos do token) nas regras de cidade.
    return {
      id: currentUser.id || id,
      user: currentUser.user || user,
      type: currentUser.type || type,
      phone: currentUser.phone || phone,
      permission: currentUser.permission || permission,
      cityId: currentUser.cityId || cityId,
    };
  }
}
