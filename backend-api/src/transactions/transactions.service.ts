import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';

export interface TransactionQuery {
    type?: 'cash_in' | 'cash_out';
    page?: number;
    limit?: number;
    fromDate?: string;
    toDate?: string;
}

@Injectable()
export class TransactionsService {
    constructor(
        @InjectRepository(Transaction)
        private readonly repo: Repository<Transaction>,
    ) {}

    async findAll(userId: number, query: TransactionQuery) {
        const page  = Math.max(1, query.page  ?? 1);
        const limit = Math.min(100, query.limit ?? 30);
        const skip  = (page - 1) * limit;

        const qb = this.repo
            .createQueryBuilder('tx')
            .where('tx.userId = :userId', { userId })
            .orderBy('tx.txTimestamp', 'DESC')
            .skip(skip)
            .take(limit);

        if (query.type) {
            qb.andWhere('tx.type = :type', { type: query.type });
        }

        if (query.fromDate) {
            qb.andWhere('tx.txTimestamp >= :fromDate', { fromDate: new Date(query.fromDate) });
        }

        if (query.toDate) {
            const toDateObj = new Date(query.toDate);
            toDateObj.setHours(23, 59, 59, 999);
            qb.andWhere('tx.txTimestamp <= :toDate', { toDate: toDateObj });
        }

        const [data, total] = await qb.getManyAndCount();

        return {
            data: data.map(tx => this.toDto(tx)),
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        };
    }

    async getSummary(userId: number) {
        const row = await this.repo
            .createQueryBuilder('tx')
            .select('SUM(CASE WHEN tx.type = \'cash_in\'  THEN tx.amount ELSE 0 END)', 'cashIn')
            .addSelect('SUM(CASE WHEN tx.type = \'cash_out\' THEN tx.amount ELSE 0 END)', 'cashOut')
            .where('tx.userId = :userId', { userId })
            .getRawOne<{ cashIn: string; cashOut: string }>();

        return {
            cashIn:   Number(row?.cashIn  ?? 0),
            cashOut:  Number(row?.cashOut ?? 0),
            currency: 'Ks',
        };
    }

    async getRecent(userId: number, count = 3) {
        const txs = await this.repo.find({
            where: { userId },
            order: { txTimestamp: 'DESC' },
            take: count,
        });
        return txs.map(tx => this.toDto(tx));
    }

    private toDto(tx: Transaction) {
        return {
            id:        tx.id,
            walletApp: tx.walletApp,
            type:      tx.type,
            amount:    Number(tx.amount),
            fee:       Number(tx.fee),
            balance:   Number(tx.balance),
            currency:  tx.currency,
            timestamp: tx.txTimestamp.toISOString(),
        };
    }
}
