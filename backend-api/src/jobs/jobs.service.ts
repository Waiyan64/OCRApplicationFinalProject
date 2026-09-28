import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OcrJob } from '../entities/ocr-job.entity';
import { Transaction } from '../entities/transaction.entity';
import { ConfirmJobDto } from './dto/confirm-job.dto';

@Injectable()
export class JobsService {
    constructor(
        @InjectRepository(OcrJob)
        private readonly repo: Repository<OcrJob>,
        private readonly dataSource: DataSource,
    ) { }

    async findByJobId(jobId: string, userId: number) {
        const job = await this.repo.findOne({ where: { id: jobId, userId } });
        if (!job) throw new NotFoundException(`Job ${jobId} not found`);
        return {
            jobId: job.id,
            status: job.status,
            walletApp: job.walletApp,
            txType: job.txType,
            result: job.resultJson,
            confirmedAmount: (job.resultJson as { confirmation?: { amount: number } } | null)?.confirmation?.amount ?? null,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
        };
    }

    async findPendingReviews(userId: number) {
        const jobs = await this.repo.find({
            where: { userId, status: 'awaiting_confirmation' },
            order: { updatedAt: 'DESC' },
            take: 50,
        });
        return jobs.map(job => ({
            jobId: job.id,
            status: job.status,
            walletApp: job.walletApp,
            txType: job.txType,
            result: job.resultJson,
        }));
    }

    async createJob(params: {
        jobId: string;
        userId: number;
        walletApp: string;
        txType?: 'cash_in' | 'cash_out';
    }): Promise<OcrJob> {
        const job = this.repo.create({
            id: params.jobId,
            userId: params.userId,
            walletApp: params.walletApp,
            txType: params.txType ?? null,
            status: 'pending',
        });
        return this.repo.save(job);
    }

    async updateJobResult(
        jobId: string,
        status: OcrJob['status'],
        resultJson: Record<string, unknown>,
    ): Promise<{ job: OcrJob; updated: boolean }> {
        const job = await this.repo.findOne({ where: { id: jobId } });
        if (!job) throw new NotFoundException(`Job ${jobId} not found`);
        if (job.status === 'awaiting_confirmation' || job.status === 'processed' || job.status === 'failed' || job.status === 'rejected') {
            return { job, updated: false };
        }
        job.status = status;
        job.resultJson = resultJson;
        return { job: await this.repo.save(job), updated: true };
    }

    async confirmJob(jobId: string, userId: number, input: ConfirmJobDto) {
        return this.dataSource.transaction(async manager => {
            const job = await manager.getRepository(OcrJob).findOne({
                where: { id: jobId, userId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!job) throw new NotFoundException(`Job ${jobId} not found`);
            if (job.status !== 'awaiting_confirmation' || !job.resultJson) {
                throw new ConflictException('This OCR job is not awaiting confirmation.');
            }
            if (!job.txType) throw new BadRequestException('Transaction type is missing from the upload.');
            if (!Number.isSafeInteger(input.amount) || input.amount < 1 || input.amount > 1_000_000_000) {
                throw new BadRequestException('Amount must be a whole number between 1 and 1,000,000,000 Ks.');
            }

            const fields = (job.resultJson as { fields?: Record<string, { value?: string | null }> }).fields;
            if (!fields?.amount?.value) {
                throw new BadRequestException('OCR amount is missing. Upload a clearer image.');
            }

            const transactionRepo = manager.getRepository(Transaction);
            const existing = await transactionRepo.findOne({ where: { ocrJobId: jobId } });
            if (existing) throw new ConflictException('Transaction has already been confirmed.');

            const fee = Number(fields.fee?.value ?? 0);
            const balance = Number(fields.balance?.value ?? 0);
            const timestamp = fields.timestamp?.value ? new Date(fields.timestamp.value) : new Date();
            await transactionRepo.save(transactionRepo.create({
                userId: job.userId,
                walletApp: job.walletApp,
                type: job.txType,
                amount: input.amount,
                fee: Number.isSafeInteger(fee) && fee >= 0 ? fee : 0,
                balance: Number.isSafeInteger(balance) && balance >= 0 ? balance : 0,
                currency: 'Ks',
                ocrJobId: job.id,
                txTimestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
            }));

            job.status = 'processed';
            job.resultJson = { ...job.resultJson, confirmation: { amount: input.amount } };
            await manager.getRepository(OcrJob).save(job);
            return { jobId: job.id, status: job.status, confirmedAmount: input.amount };
        });
    }

    async rejectJob(jobId: string, userId: number) {
        return this.dataSource.transaction(async manager => {
            const repository = manager.getRepository(OcrJob);
            const job = await repository.findOne({
                where: { id: jobId, userId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!job) throw new NotFoundException(`Job ${jobId} not found`);
            if (job.status !== 'awaiting_confirmation') {
                throw new ConflictException('This OCR job is not awaiting confirmation.');
            }
            job.status = 'rejected';
            await repository.save(job);
            return { jobId: job.id, status: job.status };
        });
    }
}
