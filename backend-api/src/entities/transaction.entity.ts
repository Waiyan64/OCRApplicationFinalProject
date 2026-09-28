import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('transactions')
export class Transaction {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'user_id' })
    userId!: number;

    @Column({ name: 'wallet_app', length: 50 })
    walletApp!: string;

    @Column({ type: 'enum', enum: ['cash_in', 'cash_out'] })
    type!: 'cash_in' | 'cash_out';

    @Column({ type: 'bigint' })
    amount!: number;

    @Column({ type: 'bigint', default: 0 })
    fee!: number;

    @Column({ type: 'bigint', default: 0 })
    balance!: number;

    @Column({ length: 10, default: 'Ks' })
    currency!: string;

    @Column({ name: 'ocr_job_id', type: 'varchar', length: 36, nullable: true })
    ocrJobId!: string | null;

    @Column({ name: 'tx_timestamp', type: 'datetime' })
    txTimestamp!: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}
