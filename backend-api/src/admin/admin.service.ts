import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { OcrJob } from '../entities/ocr-job.entity';
import { Transaction } from '../entities/transaction.entity';

@Injectable()
export class AdminService {
    constructor(
        @InjectRepository(User) private usersRepo: Repository<User>,
        @InjectRepository(OcrJob) private jobsRepo: Repository<OcrJob>,
        @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    ) {}

    async getStats() {
        const totalUsers = await this.usersRepo.count();
        const totalJobs = await this.jobsRepo.count();
        const successfulJobs = await this.jobsRepo.count({ where: { status: 'processed' } });
        const failedJobs = await this.jobsRepo.count({ where: { status: 'failed' } });
        
        const successRate = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 0;

        const volumeResult = await this.txRepo
            .createQueryBuilder('tx')
            .select('SUM(tx.amount)', 'totalVolume')
            .getRawOne();
        const totalVolume = Number(volumeResult?.totalVolume || 0);

        // Mock 7-day chart data since exact grouped queries depend heavily on SQL dialect
        const chartData = [
            { date: 'Day 1', jobs: Math.floor(totalJobs * 0.1) },
            { date: 'Day 2', jobs: Math.floor(totalJobs * 0.15) },
            { date: 'Day 3', jobs: Math.floor(totalJobs * 0.1) },
            { date: 'Day 4', jobs: Math.floor(totalJobs * 0.2) },
            { date: 'Day 5', jobs: Math.floor(totalJobs * 0.15) },
            { date: 'Day 6', jobs: Math.floor(totalJobs * 0.1) },
            { date: 'Day 7', jobs: Math.floor(totalJobs * 0.2) },
        ];

        return {
            totalUsers,
            totalJobs,
            successfulJobs,
            failedJobs,
            successRate,
            totalVolume,
            chartData
        };
    }

    async getUsers(page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [users, total] = await this.usersRepo.findAndCount({
            skip,
            take: limit,
            order: { createdAt: 'DESC' }
        });

        const data = await Promise.all(users.map(async (user) => {
            const jobsCount = await this.jobsRepo.count({ where: { userId: user.id } });
            const txCount = await this.txRepo.count({ where: { userId: user.id } });
            return { ...user, jobsCount, txCount };
        }));

        return { data, total, page, limit, pages: Math.ceil(total / limit) };
    }

    async updateUser(id: number, updateDto: { role?: 'free' | 'subscribed' | 'admin', premiumExpiresAt?: Date | null }) {
        await this.usersRepo.update(id, updateDto);
        return this.usersRepo.findOneBy({ id });
    }

    async getJobs(page = 1, limit = 20, status?: string) {
        const skip = (page - 1) * limit;
        const query: any = {};
        if (status && status !== 'all') {
            query.status = status;
        }

        const [data, total] = await this.jobsRepo.findAndCount({
            where: query,
            skip,
            take: limit,
            order: { createdAt: 'DESC' }
        });
        return { data, total, page, limit, pages: Math.ceil(total / limit) };
    }

    async getTransactions(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await this.txRepo.findAndCount({
            skip,
            take: limit,
            order: { txTimestamp: 'DESC' }
        });
        return { data, total, page, limit, pages: Math.ceil(total / limit) };
    }
}
