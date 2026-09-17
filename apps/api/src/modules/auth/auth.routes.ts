import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { env } from "../../lib/env.js";
import { UnauthorizedError } from "../../lib/errors.js";
import { parseOrThrow } from "../../lib/validation.js";
import { captureRoutePath } from "../../middleware/requestLogger.js";

const loginSchema = z.object({
  username: z.string().min(1, "username is required"),
  password: z.string().min(1, "password is required"),
});

export const authRouter = Router();

authRouter.post("/login", captureRoutePath, async (req, res) => {
  req.operation = "auth.login";

  const { username, password } = parseOrThrow(loginSchema, req.body);

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (!user) {
    throw new UnauthorizedError("Invalid username or password", "INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid username or password", "INVALID_CREDENTIALS");
  }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
  );

  res.status(200).json({ token, role: user.role, username: user.username });
});
