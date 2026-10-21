import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { z } from "zod";

declare global {
  namespace Express {
    interface Locals {
      requestId: string;
    }
  }
}

const requestIdSchema = z.uuid();

// An upstream UUID is kept so web and API logs share one ID. Anything else
// is replaced rather than echoed, which keeps caller input out of logs.
export const requestId: RequestHandler = (request, response, next) => {
  const incoming = requestIdSchema.safeParse(request.get("x-request-id"));
  const id = incoming.success ? incoming.data : randomUUID();

  response.locals.requestId = id;
  response.set("X-Request-Id", id);
  next();
};
