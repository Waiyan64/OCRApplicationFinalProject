import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        TransactionsModule,
    ],
    controllers: [DashboardController],
    providers: [DashboardService],
})
export class DashboardModule {}
