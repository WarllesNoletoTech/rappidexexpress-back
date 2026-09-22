import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './user/user.module';
import { AuthenticatorModule } from './authenticator/authenticator.module';
import { DeliveryModule } from './delivery/delivery.module';
import { CityModule } from './city/city.module';
import { IfoodModule } from './ifood/ifood.module';
import { FinancialSettlementModule } from './financial-settlement/financial-settlement.module';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PostgresPoolInterceptor } from './database/postgres-pool.interceptor';

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
    IfoodModule,
    FinancialSettlementModule,
  ],
  controllers: [AppController, SecurityController],
  providers: [
    AppService,
    SecurityService,
    { provide: APP_INTERCEPTOR, useClass: PostgresPoolInterceptor },
  ],
})
export class AppModule {}
