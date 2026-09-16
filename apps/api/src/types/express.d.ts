import "express";

declare global {
  namespace Express {
    interface Request {
      id: string;
      operation?: string;
      user?: {
        userId: string;
        username: string;
        role: "ANALYST" | "SUPERVISOR";
      };
    }
  }
}
