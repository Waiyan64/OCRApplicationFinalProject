import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OcrJob } from '../entities/ocr-job.entity';
import { Transaction } from '../entities/transaction.entity';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
    imports: [TypeOrmModule.forFeature([OcrJob, Transaction])],
    controllers: [JobsController],
    providers: [JobsService],
    exports: [JobsService],
})
export class JobsModule { }
