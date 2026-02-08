import { z } from "zod";

export const haCallSchema = z.object({
  domain: z.string().min(1),
  service: z.string().min(1),
  entityIds: z.array(z.string().min(1)).optional(),
  data: z.record(z.unknown()).optional()
});

export const haCallsSchema = z.array(haCallSchema).min(1);

export type HaCall = z.infer<typeof haCallSchema>;

export const createRoleSchema = z.object({
  name: z.string().min(1)
});

export const createActionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  haCalls: haCallsSchema,
  status: z.enum(["active", "disabled"]).default("active"),
  roleIds: z.array(z.string().min(1)).min(1)
});

export const updateActionSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  haCalls: haCallsSchema.optional(),
  status: z.enum(["active", "disabled"]).optional(),
  roleIds: z.array(z.string().min(1)).optional()
});

export const createClientSchema = z.object({
  name: z.string().min(1),
  roleId: z.string().min(1),
  status: z.enum(["active", "disabled"]).default("active")
});

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  status: z.enum(["active", "disabled"]).optional()
});

export const loginSchema = z.object({
  password: z.string().min(1)
});

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});
