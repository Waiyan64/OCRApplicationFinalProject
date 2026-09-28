import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSync } from 'class-validator';
import { OcrJob } from '../entities/ocr-job.entity';
import { Transaction } from '../entities/transaction.entity';
import { OcrCallbackService } from '../ocr-callback/ocr-callback.service';
import { ConfirmJobDto } from './dto/confirm-job.dto';
import { JobsService } from './jobs.service';

function setup() {
    const job = {
        id: 'test-job',
        userId: 7,
        status: 'pending',
        walletApp: 'ayapay',
        txType: 'cash_out',
        resultJson: null as Record<string, unknown> | null,
    } as OcrJob;
    const transactions: Transaction[] = [];
    const jobRepository = {
        findOne: async ({ where }: { where: { id: string; userId?: number } }) =>
            job.id === where.id && (where.userId === undefined || job.userId === where.userId) ? job : null,
        find: async ({ where }: { where: { userId: number } }) =>
            job.status === 'awaiting_confirmation' && job.userId === where.userId ? [job] : [],
        save: async (value: OcrJob) => Object.assign(job, value),
    };
    const transactionRepository = {
        findOne: async ({ where }: { where: { ocrJobId: string } }) =>
            transactions.find(transaction => transaction.ocrJobId === where.ocrJobId) ?? null,
        create: (value: Transaction) => value,
        save: async (value: Transaction) => { transactions.push(value); return value; },
    };
    const dataSource = {
        transaction: async (action: (manager: { getRepository: (entity: unknown) => unknown }) => Promise<unknown>) =>
            action({ getRepository: entity => entity === OcrJob ? jobRepository : transactionRepository }),
    };
    const service = new JobsService(jobRepository as never, dataSource as never);
    return { service, job, transactions };
}

test('OCR callback stores a reviewable draft without creating a transaction', async () => {
    const { service, job, transactions } = setup();
    const callback = new OcrCallbackService(service);
    const payload = {
        job_id: job.id,
        status: 'processed',
        wallet_app_type: 'ayapay',
        fields: { amount: { value: '100', confidence: 0.9 } },
    };
    await callback.save(payload as never, 'hmac', { signaturePresent: true });
    await callback.save(payload as never, 'hmac', { signaturePresent: true });
    assert.equal(job.status, 'awaiting_confirmation');
    assert.equal(transactions.length, 0);
    assert.equal((await service.findPendingReviews(7)).length, 1);
    assert.equal((await service.findPendingReviews(8)).length, 0);
    await assert.rejects(service.findByJobId(job.id, 8), { name: 'NotFoundException' });
});

test('only the owner can confirm; corrected amount is saved once', async () => {
    const { service, job, transactions } = setup();
    job.status = 'awaiting_confirmation';
    job.resultJson = { fields: { amount: { value: '100' }, fee: { value: '0' } } };

    await assert.rejects(service.confirmJob(job.id, 8, { amount: 125 }), { name: 'NotFoundException' });
    assert.equal(transactions.length, 0);

    const result = await service.confirmJob(job.id, 7, { amount: 125 });
    assert.deepEqual(result, { jobId: job.id, status: 'processed', confirmedAmount: 125 });
    assert.equal(transactions.length, 1);
    assert.equal(transactions[0].amount, 125);
    assert.equal(transactions[0].userId, 7);
    assert.equal(transactions[0].type, 'cash_out');
    assert.equal((job.resultJson as { confirmation: { amount: number } }).confirmation.amount, 125);
    await assert.rejects(service.confirmJob(job.id, 7, { amount: 125 }), { name: 'ConflictException' });
    assert.equal(transactions.length, 1);
});

test('invalid amounts cannot be confirmed', () => {
    for (const amount of [0, -1, 1.5, 1_000_000_001]) {
        const dto = new ConfirmJobDto();
        dto.amount = amount;
        assert.notEqual(validateSync(dto).length, 0);
    }
});

test('missing OCR amount cannot be confirmed, and rejection saves no transaction', async () => {
    const { service, job, transactions } = setup();
    job.status = 'awaiting_confirmation';
    job.resultJson = { fields: { amount: { value: null } } };
    await assert.rejects(service.confirmJob(job.id, 7, { amount: 100 }), { name: 'BadRequestException' });
    await assert.rejects(service.rejectJob(job.id, 8), { name: 'NotFoundException' });

    assert.deepEqual(await service.rejectJob(job.id, 7), { jobId: job.id, status: 'rejected' });
    assert.equal(transactions.length, 0);
    await assert.rejects(service.rejectJob(job.id, 7), { name: 'ConflictException' });
    await assert.rejects(service.confirmJob(job.id, 7, { amount: 100 }), { name: 'ConflictException' });
});