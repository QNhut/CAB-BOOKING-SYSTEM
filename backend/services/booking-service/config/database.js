import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;

export const pool = new Pool({ connectionString: DATABASE_URL });

export async function runMigrations() {
  const migrations = ["0001_init.sql", "0002_user_id_text.sql", "0003_add_driver_id.sql", "0004_idempotency_key.sql"];
  for (const m of migrations) {
    const file = path.join(__dirname, "..", "migrations", m);
    if (fs.existsSync(file)) {
      const sql = fs.readFileSync(file, "utf8");
      await pool.query(sql);
      console.log(`✅ migration applied: ${m}`);
    }
  }
}
