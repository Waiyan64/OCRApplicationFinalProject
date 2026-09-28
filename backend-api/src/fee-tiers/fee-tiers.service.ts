import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeeTier } from '../entities/fee-tier.entity';
import { CreateFeeTierDto, UpdateFeeTierDto } from './dto/fee-tier.dto';

@Injectable()
export class FeeTiersService {
    constructor(
        @InjectRepository(FeeTier)
        private readonly repo: Repository<FeeTier>,
    ) {}

    findAll(userId: number): Promise<FeeTier[]> {
        return this.repo.find({
            where: { userId },
            order: { minAmount: 'ASC' },
        });
    }

    async create(userId: number, dto: CreateFeeTierDto): Promise<FeeTier> {
        const tier = this.repo.create({
            userId,
            minAmount: dto.minAmount,
            maxAmount: dto.maxAmount,
            fee:       dto.fee,
        });
        return this.repo.save(tier);
    }

    async update(userId: number, id: number, dto: UpdateFeeTierDto): Promise<FeeTier> {
        const tier = await this.repo.findOne({ where: { id, userId } });
        if (!tier) throw new NotFoundException(`Fee tier ${id} not found`);
        Object.assign(tier, dto);
        return this.repo.save(tier);
    }

    async remove(userId: number, id: number): Promise<{ deleted: true }> {
        const tier = await this.repo.findOne({ where: { id, userId } });
        if (!tier) throw new NotFoundException(`Fee tier ${id} not found`);
        await this.repo.remove(tier);
        return { deleted: true };
    }
}
