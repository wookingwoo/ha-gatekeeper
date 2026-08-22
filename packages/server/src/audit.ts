import type { FastifyBaseLogger } from "fastify";
import { prisma } from "./db.js";

export async function logAudit(
  logger: FastifyBaseLogger,
  params: {
    clientId: string | null;
    permissionId: string | null;
    actionIdRaw: string;
    ip: string | null;
    success: boolean;
    error?: string | null;
  }
) {
  try {
    await prisma.auditLog.create({
      data: {
        clientId: params.clientId,
        permissionId: params.permissionId,
        actionIdRaw: params.actionIdRaw,
        ip: params.ip,
        success: params.success,
        error: params.error ?? null
      }
    });
  } catch (err) {
    logger.error({ err }, "audit_log_failed");
  }
}
