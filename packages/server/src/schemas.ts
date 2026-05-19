import { z } from "zod";

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

export const quickSetupSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  permissions: tokenPermissionsSchema
});
