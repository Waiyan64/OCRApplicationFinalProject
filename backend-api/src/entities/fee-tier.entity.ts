import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fee_tiers')
export class FeeTier {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'user_id' })
    userId!: number;

    @Column({ name: 'min_amount', type: 'bigint' })
    minAmount!: number;

    @Column({ name: 'max_amount', type: 'bigint' })
    maxAmount!: number;

    @Column({ type: 'bigint' })
    fee!: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
