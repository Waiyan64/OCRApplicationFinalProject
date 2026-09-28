import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { OcrCallbackModule } from './ocr-callback/ocr-callback.module';
import { OcrGatewayModule } from './ocr-gateway/ocr-gateway.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TransactionsModule } from './transactions/transactions.module';
import { JobsModule } from './jobs/jobs.module';
import { FeeTiersModule } from './fee-tiers/fee-tiers.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        OcrCallbackModule,
        OcrGatewayModule,
        DashboardModule,
        TransactionsModule,
        JobsModule,
        FeeTiersModule,
        AdminModule,
        AuthModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}
