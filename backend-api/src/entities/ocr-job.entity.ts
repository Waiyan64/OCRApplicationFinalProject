import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type OcrJobStatus = 'pending' | 'processing' | 'awaiting_confirmation' | 'processed' | 'failed' | 'rejected';

@Entity('ocr_jobs')
export class OcrJob {
    @PrimaryColumn({ length: 36 })
    id!: string;

    @Column({ name: 'user_id' })
    userId!: number;

    @Column({ type: 'enum', enum: ['pending', 'processing', 'awaiting_confirmation', 'processed', 'failed', 'rejected'], default: 'pending' })
    status!: OcrJobStatus;

    @Column({ name: 'wallet_app', length: 50 })
    walletApp!: string;

    @Column({ name: 'tx_type', type: 'enum', enum: ['cash_in', 'cash_out'], nullable: true })
    txType!: 'cash_in' | 'cash_out' | null;

    @Column({ name: 'image_path', type: 'varchar', length: 500, nullable: true })
    imagePath!: string | null;

    @Column({ name: 'result_json', type: 'json', nullable: true })
    resultJson!: Record<string, unknown> | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
