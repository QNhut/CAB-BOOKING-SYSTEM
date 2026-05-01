import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL missing");
  process.exit(1);
}

export const pool = new Pool({ connectionString: DATABASE_URL });

export async function runMigrations() {
  const dir = path.join(__dirname, "..", "migrations");
  if (!fs.existsSync(dir)) {
    console.log("⚠️  No migrations folder, skipping migrations");
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    try {
      const sql = fs.readFileSync(path.join(dir, f), "utf8");
      await pool.query(sql);
    } catch (err) {
      if (err.code !== "42P07") throw err;
      console.log(`⏭️  Skipping ${f} (already applied)`);
    }
  }
  console.log("✅ auth migrations applied:", files.join(", "));
}
