import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ["req.headers.authorization", "password", "req.body.password", "token"],
    censor: "[REDACTED]",
  },
});
