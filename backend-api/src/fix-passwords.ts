import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();

const ds = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASS ?? '',
    database: process.env.DB_NAME ?? 'ocr_research',
    entities: [User],
});

async function run() {
    await ds.initialize();
    const repo = ds.getRepository(User);
    const users = await repo.find();
    const hash = await bcrypt.hash('password123', 10);
    for (const u of users) {
        u.passwordHash = hash;
        await repo.save(u);
    }
    console.log('Fixed passwords to password123');
    await ds.destroy();
}
run();
