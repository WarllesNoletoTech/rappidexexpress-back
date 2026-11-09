import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './user/user.module';
import { AuthenticatorModule } from './authenticator/authenticator.module';
import { DeliveryModule } from './delivery/delivery.module';
import { CityModule } from './city/city.module';
import { RegionsModule } from './regions/regions.module';
import { RankingModule } from './ranking/ranking.module';
import { IfoodModule } from './ifood/ifood.module';
import { FinancialSettlementModule } from './financial-settlement/financial-settlement.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './database/entities';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { MenuFlowIntegrationModule } from './menuflow-integration/menuflow-integration.module';
import { MotoProIntegrationModule } from './motopro-integration/motopro-integration.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    UserModule,
    AuthenticatorModule,
    DeliveryModule,
    CityModule,
    RegionsModule,
    RankingModule,
    IfoodModule,
    FinancialSettlementModule,
    MenuFlowIntegrationModule,
    MotoProIntegrationModule,
    TypeOrmModule.forFeature([UserEntity]),
  ],
  controllers: [AppController, SecurityController],
  providers: [AppService, SecurityService],
})
export class AppModule {}
