import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeTier } from '../entities/fee-tier.entity';
import { FeeTiersController } from './fee-tiers.controller';
import { FeeTiersService } from './fee-tiers.service';

@Module({
    imports: [TypeOrmModule.forFeature([FeeTier])],
    controllers: [FeeTiersController],
    providers: [FeeTiersService],
})
export class FeeTiersModule {}
