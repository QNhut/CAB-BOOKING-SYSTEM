import { app, migrate, log } from "./app.js";

const PORT = Number(process.env.PORT || 8013);

migrate()
  .then(() => app.listen(PORT, () => log.info("started", { port: PORT })))
  .catch((err) => { log.error("migration failed", { error: err.message }); process.exit(1); });
