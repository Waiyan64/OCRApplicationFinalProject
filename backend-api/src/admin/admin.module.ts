import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../entities/user.entity';
import { OcrJob } from '../entities/ocr-job.entity';
import { Transaction } from '../entities/transaction.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User, OcrJob, Transaction])],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule {}
