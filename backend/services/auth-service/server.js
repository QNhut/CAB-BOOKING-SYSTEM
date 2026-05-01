import bcrypt from "bcrypt";
import { app, runMigrations, pool, BCRYPT_ROUNDS } from "./app.js";

const PORT = Number(process.env.PORT || 8001);

const DEFAULT_TEST_ACCOUNTS = [
  {
    identifier: 'admin@taxi.com',
    password: 'admin123',
    role: 'ADMIN',
    logLabel: 'ADMIN',
  },
  {
    identifier: 'driver@test.com',
    password: '123456',
    role: 'DRIVER',
    logLabel: 'DRIVER',
  },
];

async function main() {
  await runMigrations();

  try {
    for (const account of DEFAULT_TEST_ACCOUNTS) {
      const { rows } = await pool.query(
        'SELECT id FROM accounts WHERE identifier = $1 LIMIT 1',
        [account.identifier]
      );

      if (rows.length > 0) {
        continue;
      }

      const hash = await bcrypt.hash(account.password, BCRYPT_ROUNDS);
      await pool.query(
        `INSERT INTO accounts (identifier, password_hash, role, status)
         VALUES ($1, $2, $3, 'ACTIVE')
         ON CONFLICT (identifier) DO NOTHING`,
        [account.identifier, hash, account.role]
      );
      console.log(`🔑 Default ${account.logLabel} account created: ${account.identifier} / ${account.password}`);
    }
  } catch (e) {
    console.warn('⚠️  Could not seed default test accounts:', e.message);
  }

  app.listen(PORT, () => {
    console.log(`✅ Auth Service listening on http://localhost:${PORT}`);
    console.log(`   JWT Access TTL: ${process.env.JWT_ACCESS_TTL || 900}s`);
    console.log(`   JWT Refresh TTL: ${process.env.JWT_REFRESH_TTL || 2592000}s`);
  });
}

main().catch((err) => {
  console.error("❌ auth-service fatal:", err);
  process.exit(1);
});
