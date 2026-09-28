import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Transaction } from './entities/transaction.entity';
import { FeeTier } from './entities/fee-tier.entity';
import { OcrJob } from './entities/ocr-job.entity';
import * as dotenv from 'dotenv';

dotenv.config();

const ds = new DataSource({
    type: 'mysql',
    host:     process.env.DB_HOST ?? 'localhost',
    port:     Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASS ?? '',
    database: process.env.DB_NAME ?? 'ocr_research',
    entities: [User, Transaction, FeeTier, OcrJob],
    synchronize: true,
});

async function seed() {
    await ds.initialize();
    console.log('Connected. Seeding...');

    const userRepo = ds.getRepository(User);
    const txRepo   = ds.getRepository(Transaction);
    const feeRepo  = ds.getRepository(FeeTier);

    // ── Seed users ────────────────────────────────────────────────────────────
    let user = await userRepo.findOne({ where: { id: 1 } });
    if (!user) {
        user = userRepo.create({
            name:             'Aung Ye Htun',
            email:            'aungye@example.com',
            passwordHash:     'stub-hash',
            role:             'subscribed',
            premiumExpiresAt: new Date(Date.now() + 30 * 86_400_000),
        });
        user = await userRepo.save(user);
        console.log('  ✓ User created:', user.name);
    } else {
        console.log('  → Main user already exists');
    }

    const totalUsers = await userRepo.count();
    if (totalUsers < 5) {
        const extraUsers = [
            { name: 'Zaw Min Thu', email: 'zawmin@example.com', role: 'free' as const },
            { name: 'Nwe Nwe Win', email: 'nwenwe@example.com', role: 'subscribed' as const, premiumDays: 15 },
            { name: 'System Admin', email: 'admin@example.com', role: 'admin' as const },
            { name: 'Kyaw Zin Phyo', email: 'kyawzin@example.com', role: 'free' as const },
            { name: 'Su Su Hlaing', email: 'susu@example.com', role: 'subscribed' as const, premiumDays: 5 },
        ];
        
        for (const eu of extraUsers) {
            const exists = await userRepo.findOne({ where: { email: eu.email } });
            if (!exists) {
                await userRepo.save(userRepo.create({
                    name: eu.name,
                    email: eu.email,
                    role: eu.role,
                    passwordHash: 'stub-hash',
                    premiumExpiresAt: eu.premiumDays ? new Date(Date.now() + eu.premiumDays * 86_400_000) : null
                }));
            }
        }
        console.log(`  ✓ Extra users created`);
    } else {
        console.log(`  → Extra users already exist`);
    }

    // ── Seed transactions ────────────────────────────────────────────────────
    const txCount = await txRepo.count({ where: { userId: 1 } });
    if (txCount === 0) {
        const now = Date.now();
        const txData = [
            { walletApp: 'kbzpay',  type: 'cash_in'  as const, amount: 10_000,  fee: 500,  balance: 1_000_000, hours: 2 },
            { walletApp: 'kbzpay',  type: 'cash_in'  as const, amount: 25_000,  fee: 500,  balance: 1_025_000, hours: 3 },
            { walletApp: 'wavepay', type: 'cash_out' as const, amount: 5_000,   fee: 300,  balance: 990_000,   hours: 4 },
            { walletApp: 'wavepay', type: 'cash_in'  as const, amount: 50_000,  fee: 1000, balance: 1_040_000, hours: 26 },
            { walletApp: 'cbpay',   type: 'cash_out' as const, amount: 8_500,   fee: 400,  balance: 931_500,   hours: 30 },
            { walletApp: 'ayapay',  type: 'cash_in'  as const, amount: 100_000, fee: 2000, balance: 1_031_500, hours: 34 },
            { walletApp: 'kbzpay',  type: 'cash_out' as const, amount: 15_000,  fee: 500,  balance: 1_016_500, hours: 50 },
            { walletApp: 'wavepay', type: 'cash_in'  as const, amount: 30_000,  fee: 500,  balance: 1_046_500, hours: 55 },
            { walletApp: 'cbpay',   type: 'cash_out' as const, amount: 12_000,  fee: 500,  balance: 1_034_500, hours: 72 },
            { walletApp: 'ayapay',  type: 'cash_in'  as const, amount: 75_000,  fee: 1500, balance: 1_109_500, hours: 78 },
        ];

        for (const d of txData) {
            const tx = txRepo.create({
                userId:      1,
                walletApp:   d.walletApp,
                type:        d.type,
                amount:      d.amount,
                fee:         d.fee,
                balance:     d.balance,
                currency:    'Ks',
                txTimestamp:  new Date(now - d.hours * 3_600_000),
            });
            await txRepo.save(tx);
        }
        console.log(`  ✓ ${txData.length} transactions created`);
    } else {
        console.log(`  → ${txCount} transactions already exist`);
    }

    // ── Seed fee tiers ───────────────────────────────────────────────────────
    const feeCount = await feeRepo.count({ where: { userId: 1 } });
    if (feeCount === 0) {
        const tiers = [
            { minAmount: 1000,   maxAmount: 10000,  fee: 500 },
            { minAmount: 10001,  maxAmount: 50000,  fee: 1000 },
            { minAmount: 50001,  maxAmount: 100000, fee: 2000 },
        ];
        for (const t of tiers) {
            await feeRepo.save(feeRepo.create({ userId: 1, ...t }));
        }
        console.log(`  ✓ ${tiers.length} fee tiers created`);
    } else {
        console.log(`  → ${feeCount} fee tiers already exist`);
    }

    console.log('Seed complete.');
    await ds.destroy();
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
