PRAGMA foreign_keys=OFF;

CREATE TEMPORARY TABLE "_TokenPermissionSeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "domain" TEXT,
    "services" TEXT NOT NULL,
    "entityIds" TEXT NOT NULL,
    "allowNoEntity" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL
);

INSERT INTO "_TokenPermissionSeed" (
    "id",
    "clientId",
    "kind",
    "domain",
    "services",
    "entityIds",
    "allowNoEntity",
    "createdAt"
)
SELECT
    'perm_' || lower(hex(randomblob(12))),
    "Client"."id",
    'service',
    json_extract("Action"."haCalls", '$[0].domain'),
    json_array(json_extract("Action"."haCalls", '$[0].service')),
    COALESCE(json_extract("Action"."haCalls", '$[0].entityIds'), '[]'),
    COALESCE(json_extract("Action"."haCalls", '$[0].allowNoEntity'), 0),
    "Action"."createdAt"
FROM "Client"
JOIN "RoleAction" ON "RoleAction"."roleId" = "Client"."roleId"
JOIN "Action" ON "Action"."id" = "RoleAction"."actionId"
WHERE
    "Action"."status" = 'active'
    AND json_valid("Action"."haCalls")
    AND json_extract("Action"."haCalls", '$[0].domain') IS NOT NULL
    AND json_extract("Action"."haCalls", '$[0].service') IS NOT NULL;

CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "apiKeyHash" TEXT NOT NULL,
    "apiKeyPrefix" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_Client" (
    "id",
    "name",
    "status",
    "apiKeyHash",
    "apiKeyPrefix",
    "createdAt"
)
SELECT
    "id",
    "name",
    "status",
    "apiKeyHash",
    "apiKeyPrefix",
    "createdAt"
FROM "Client";

CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT,
    "permissionId" TEXT,
    "actionIdRaw" TEXT NOT NULL,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL,
    "error" TEXT
);

INSERT INTO "new_AuditLog" (
    "id",
    "timestamp",
    "clientId",
    "permissionId",
    "actionIdRaw",
    "ip",
    "success",
    "error"
)
SELECT
    "id",
    "timestamp",
    "clientId",
    NULL,
    "actionIdRaw",
    "ip",
    "success",
    "error"
FROM "AuditLog";

DROP TABLE "AuditLog";
DROP TABLE "RoleAction";
DROP TABLE "Action";
DROP TABLE "Role";
DROP TABLE "Client";

ALTER TABLE "new_Client" RENAME TO "Client";

CREATE TABLE "TokenPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "domain" TEXT,
    "services" TEXT NOT NULL DEFAULT '[]',
    "entityIds" TEXT NOT NULL,
    "allowNoEntity" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenPermission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "TokenPermission" (
    "id",
    "clientId",
    "kind",
    "domain",
    "services",
    "entityIds",
    "allowNoEntity",
    "createdAt"
)
SELECT
    "id",
    "clientId",
    "kind",
    "domain",
    "services",
    "entityIds",
    "allowNoEntity",
    "createdAt"
FROM "_TokenPermissionSeed";

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT,
    "permissionId" TEXT,
    "actionIdRaw" TEXT NOT NULL,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    CONSTRAINT "AuditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "TokenPermission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "AuditLog" (
    "id",
    "timestamp",
    "clientId",
    "permissionId",
    "actionIdRaw",
    "ip",
    "success",
    "error"
)
SELECT
    "id",
    "timestamp",
    "clientId",
    "permissionId",
    "actionIdRaw",
    "ip",
    "success",
    "error"
FROM "new_AuditLog";

DROP TABLE "new_AuditLog";
DROP TABLE "_TokenPermissionSeed";

CREATE INDEX "TokenPermission_clientId_idx" ON "TokenPermission"("clientId");
CREATE INDEX "AuditLog_clientId_idx" ON "AuditLog"("clientId");
CREATE INDEX "AuditLog_permissionId_idx" ON "AuditLog"("permissionId");

PRAGMA foreign_keys=ON;
