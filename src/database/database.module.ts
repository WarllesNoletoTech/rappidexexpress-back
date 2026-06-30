import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { DeliveryEntity, UserEntity } from './entities';
import { CityEntity } from './entities/city.entity';
import { CitySeedService } from './seeds/city-seed.service';
import { DatabaseBootstrapService } from './database-bootstrap.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';

        return {
          type: 'mongodb',
          url: configService.get<string>('MONGODB_URI'),
          manualInitialization: true,
          retryAttempts: 1,
          retryDelay: 1000,
          connectTimeoutMS:
            Number(configService.get<string>('MONGODB_CONNECT_TIMEOUT_MS')) ||
            10000,
          serverSelectionTimeoutMS:
            Number(
              configService.get<string>('MONGODB_SERVER_SELECTION_TIMEOUT_MS'),
            ) || 10000,
          entities: [join(__dirname, '**/*.entity{.ts,.js}')],
          synchronize:
            !isProduction &&
            configService.get<string>('TYPEORM_SYNCHRONIZE') === 'true',
          logging:
            !isProduction &&
            configService.get<string>('TYPEORM_LOGGING') === 'true',
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([UserEntity, DeliveryEntity, CityEntity]),
  ],
  providers: [CitySeedService, DatabaseBootstrapService],
  exports: [TypeOrmModule.forFeature([UserEntity, DeliveryEntity, CityEntity])],
})
export class DatabaseModule {}
