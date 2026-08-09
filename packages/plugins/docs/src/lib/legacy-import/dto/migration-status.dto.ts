import { PartialType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * Query params of `GET /api/plugins/docs/migrations/status` (§5.1).
 *
 * Extends a partial `TenantOrganizationBaseDTO` so `organizationId` keeps the same
 * `@IsOrganizationBelongsToUser()` ownership check the write DTOs carry — a caller can never poll
 * an organization they do not belong to. Both fields stay optional: the service falls back to the
 * requester's current tenant/organization.
 */
export class LegacyMigrationStatusQueryDTO extends PartialType(TenantOrganizationBaseDTO) {}
