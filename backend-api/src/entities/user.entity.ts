import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 100 })
    name!: string;

    @Column({ unique: true, length: 150 })
    email!: string;

    @Column({ name: 'password_hash', length: 255 })
    passwordHash!: string;

    @Column({ type: 'enum', enum: ['free', 'subscribed', 'admin'], default: 'free' })
    role!: 'free' | 'subscribed' | 'admin';

    @Column({ name: 'premium_expires_at', type: 'datetime', nullable: true })
    premiumExpiresAt!: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}
