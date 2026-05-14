import { z } from "zod";
import type { PrivacyPolicyV1 } from "./types.js";

export const privacyPolicyV1Schema: z.ZodType<PrivacyPolicyV1> = z
  .object({
    version: z.literal("v1"),
    mode: z.enum(["fail-closed", "permissive"]).optional(),
    redact: z.array(z.string().min(1)).optional(),
    mask: z.array(z.string().min(1)).optional(),
    tokenize: z.array(z.string().min(1)).optional(),
    hmac: z.array(z.string().min(1)).optional(),
    remove: z.array(z.string().min(1)).optional(),
    allow: z.array(z.string().min(1)).optional(),
    deny: z.array(z.string().min(1)).optional(),
  })
  .strict();
