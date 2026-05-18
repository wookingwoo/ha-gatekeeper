import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { QuickSetupUseCase } from "./schemas.js";

type QuickSetupDefinition = {
  label: string;
  domain: string;
  services: string[];
};

export type QuickSetupInput = {
  useCase: QuickSetupUseCase;
  targetEntityIds: string[];
  tokenName?: string;
};

export type QuickSetupPlan = {
  clientName: string;
  roleName: string;
  actions: Array<{
    id: string;
    name: string;
    description: string;
    haCall: {
      domain: string;
      service: string;
      entityIds: string[];
      allowNoEntity: false;
    };
  }>;
};

const DEFINITIONS: Record<QuickSetupUseCase, QuickSetupDefinition> = {
  control_lights: {
    label: "Control lights",
    domain: "light",
    services: ["turn_on", "turn_off", "toggle"]
  },
  control_switches: {
    label: "Control switches",
    domain: "switch",
    services: ["turn_on", "turn_off"]
  },
  run_scripts: {
    label: "Run scripts",
    domain: "script",
    services: ["turn_on"]
  }
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function suffix(): string {
  return crypto.randomBytes(3).toString("hex");
}

export function getQuickSetupDefinition(useCase: QuickSetupUseCase): QuickSetupDefinition {
  return DEFINITIONS[useCase];
}

export function makeTokenName(useCase: QuickSetupUseCase, _targetEntityIds: string[]): string {
  return `${getQuickSetupDefinition(useCase).label} token`;
}

export function buildQuickSetupPlan(input: QuickSetupInput): QuickSetupPlan {
  const definition = getQuickSetupDefinition(input.useCase);
  const mismatched = input.targetEntityIds.find(
    (entityId) => entityId.split(".")[0] !== definition.domain
  );
  if (mismatched) {
    throw new Error(`target_domain_mismatch:${mismatched}`);
  }

  const clientName = input.tokenName?.trim() || makeTokenName(input.useCase, input.targetEntityIds);
  const roleName = `quick-${slugify(clientName)}`;
  const unique = suffix();

  return {
    clientName,
    roleName,
    actions: definition.services.map((service) => ({
      id: `${definition.domain}.${service}.${unique}`,
      name: `${clientName}: ${definition.domain}.${service}`,
      description: `Quick Setup policy for ${definition.domain}.${service}`,
      haCall: {
        domain: definition.domain,
        service,
        entityIds: input.targetEntityIds,
        allowNoEntity: false
      }
    }))
  };
}

export async function createQuickSetupAccess(prisma: PrismaClient, input: QuickSetupInput) {
  const { generateApiKey } = await import("./security.js");
  const plan = buildQuickSetupPlan(input);
  const { apiKey, apiKeyHash, apiKeyPrefix } = generateApiKey();

  const result = await prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: { name: `${plan.roleName}-${suffix()}` }
    });

    const actions = [];
    for (const action of plan.actions) {
      actions.push(
        await tx.action.create({
          data: {
            id: action.id,
            name: action.name,
            description: action.description,
            status: "active",
            haCalls: JSON.stringify([action.haCall]),
            roleActions: {
              create: [{ roleId: role.id }]
            }
          }
        })
      );
    }

    const client = await tx.client.create({
      data: {
        name: plan.clientName,
        roleId: role.id,
        status: "active",
        apiKeyHash,
        apiKeyPrefix
      }
    });

    return { role, actions, client };
  });

  return { ...result, apiKey };
}
