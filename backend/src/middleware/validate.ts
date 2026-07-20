import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

type Target = "body" | "query" | "params";

export function validate(schema: ZodTypeAny, target: Target = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      return res.status(422).json({
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: result.error.flatten(),
        traceId: req.id,
      });
    }
    req[target] = result.data;
    next();
  };
}
