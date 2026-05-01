import app from "./app.js";
import { startKafkaWithRetry } from "./services/notification.service.js";

const PORT = Number(process.env.PORT || 8006);

app.listen(PORT, () => console.log(`Notification SSE on http://localhost:${PORT}`));
startKafkaWithRetry();
