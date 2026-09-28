import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Transaction } from '../entities/transaction.entity';
import { OcrJob } from '../entities/ocr-job.entity';
import { FeeTier } from '../entities/fee-tier.entity';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                type: 'mysql',
                host:     config.get<string>('DB_HOST', 'localhost'),
                port:     config.get<number>('DB_PORT', 3306),
                username: config.get<string>('DB_USER', 'root'),
                password: config.get<string>('DB_PASS', ''),
                database: config.get<string>('DB_NAME', 'ocr_research'),
                entities: [User, Transaction, OcrJob, FeeTier],
                // synchronize = true auto-creates/migrates tables in dev.
                // Set to false and use migrations in production.
                synchronize: config.get<string>('NODE_ENV', 'development') !== 'production',
                logging: config.get<string>('NODE_ENV', 'development') === 'development',
                timezone: '+00:00',
            }),
        }),
    ],
})
export class DatabaseModule {}
