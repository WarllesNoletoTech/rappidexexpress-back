import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CityEntity } from '../database/entities/city.entity';
import { UserEntity } from '../database/entities/user.entity';
import { RankingPointEntity } from './ranking-point.entity';
import { RankingRuleEntity } from './ranking-rule.entity';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';
@Module({imports:[TypeOrmModule.forFeature([CityEntity,UserEntity,RankingPointEntity,RankingRuleEntity])],controllers:[RankingController],providers:[RankingService]})
export class RankingModule {}
