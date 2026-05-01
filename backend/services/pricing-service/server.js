import app from "./app.js";

const PORT = process.env.PORT || 8002;

app.listen(PORT, () => console.log(`Pricing service on http://localhost:${PORT}`));
