import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { ProfileDto, SummaryDto, TransactionDto } from './dashboard.dto';

@Injectable()
export class DashboardService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly txService: TransactionsService,
    ) {}

    async getProfile(userId: number): Promise<ProfileDto> {
        const user = await this.userRepo.findOne({ where: { id: userId } });

        if (!user) {
            return { name: 'Unknown', premiumDaysLeft: 0, role: 'free' };
        }

        const now   = new Date();
        const exp   = user.premiumExpiresAt;
        const daysLeft = exp
            ? Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / 86_400_000))
            : 0;

        return {
            name:           user.name,
            premiumDaysLeft: daysLeft,
            role:           user.role,
        };
    }

    async getSummary(userId: number): Promise<SummaryDto> {
        return this.txService.getSummary(userId);
    }

    async getRecentTransactions(userId: number): Promise<TransactionDto[]> {
        return this.txService.getRecent(userId, 3);
    }
}
