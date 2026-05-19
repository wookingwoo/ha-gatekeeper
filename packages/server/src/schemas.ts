import { z } from "zod";

export const haCallSchema = z
  .object({
    domain: z.string().min(1),
    service: z.string().min(1),
    entityIds: z.array(z.string().min(1)).optional(),
    allowNoEntity: z.boolean().default(false),
    data: z.record(z.unknown()).optional()
  })
  .refine((call) => call.allowNoEntity || (call.entityIds?.length ?? 0) > 0, {
    message: "entityIds or allowNoEntity is required"
  });

export const haCallsSchema = z.array(haCallSchema).min(1).max(1);

export type HaCall = z.infer<typeof haCallSchema>;

export const createRoleSchema = z.object({
  name: z.string().min(1)
});

export const createActionSchema = z.object({
  id: z.string().min(1).optional(),
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

export const serviceTokenPermissionSchema = z
  .object({
    kind: z.literal("service"),
    domain: z.string().min(1),
    services: z.array(z.string().min(1)).min(1),
    entityIds: z.array(z.string().min(1)).default([]),
    allowNoEntity: z.boolean().default(false)
  })
  .refine((permission) => permission.allowNoEntity || permission.entityIds.length > 0, {
    message: "entityIds or allowNoEntity is required"
  });

export const stateTokenPermissionSchema = z.object({
  kind: z.literal("state"),
  entityIds: z.array(z.string().min(1)).min(1)
});

export const tokenPermissionSchema = z.union([
  serviceTokenPermissionSchema,
  stateTokenPermissionSchema
]);

export type TokenPermissionInput = z.infer<typeof tokenPermissionSchema>;

export const tokenPermissionsSchema = z.array(tokenPermissionSchema).min(1);

export const createClientSchema = z.object({
  name: z.string().min(1).max(80),
  status: z.enum(["active", "disabled"]).default("active"),
  permissions: tokenPermissionsSchema
});

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["active", "disabled"]).optional()
});

export const updateClientPermissionsSchema = z.object({
  permissions: tokenPermissionsSchema
});

export const loginSchema = z.object({
  password: z.string().min(1)
});

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const quickSetupUseCaseSchema = z.enum([
  "control_lights",
  "control_switches",
  "run_scripts"
]);

export type QuickSetupUseCase = z.infer<typeof quickSetupUseCaseSchema>;

export const quickSetupSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  permissions: tokenPermissionsSchema
});
