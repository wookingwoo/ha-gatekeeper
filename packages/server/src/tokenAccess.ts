import type { PrismaClient } from "@prisma/client";
import { serializePermission, type TokenPermissionInput } from "./permissions.js";

export type TokenAccessInput = {
  name?: string;
  status?: "active" | "disabled";
  permissions: TokenPermissionInput[];
};

export type TokenAccessPlan = {
  clientName: string;
  status: "active" | "disabled";
  permissions: ReturnType<typeof serializePermission>[];
};

export function buildTokenAccessPlan(input: TokenAccessInput): TokenAccessPlan {
  const clientName = input.name?.trim() || "Home Assistant access token";

  return {
    clientName,
    status: input.status ?? "active",
    permissions: input.permissions.map((permission) => serializePermission(permission))
  };
}

export async function createTokenAccess(prisma: PrismaClient, input: TokenAccessInput) {
  const { generateApiKey } = await import("./security.js");
  const plan = buildTokenAccessPlan(input);
  const { apiKey, apiKeyHash, apiKeyPrefix } = generateApiKey();

  const client = await prisma.client.create({
    data: {
      name: plan.clientName,
      status: plan.status,
      apiKeyHash,
      apiKeyPrefix,
      permissions: {
        create: plan.permissions
      }
    },
    include: { permissions: true }
  });

  return { client, apiKey };
}

export async function replaceTokenPermissions(
  prisma: PrismaClient,
  clientId: string,
  permissions: TokenPermissionInput[]
) {
  const serialized = permissions.map((permission) => serializePermission(permission));

  return prisma.$transaction(async (tx: any) => {
    await tx.tokenPermission.deleteMany({ where: { clientId } });
    await tx.tokenPermission.createMany({
      data: serialized.map((permission) => ({ ...permission, clientId }))
    });
    return tx.client.findUnique({
      where: { id: clientId },
      include: { permissions: true }
    });
  });
}
