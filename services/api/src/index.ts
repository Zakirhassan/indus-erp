import { config } from "@indus/config";
import { app } from "./app.js";

app.listen(config.PORT, () => {
  console.log(`[api] Listening on http://localhost:${config.PORT}`);
});
