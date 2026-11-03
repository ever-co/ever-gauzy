import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * One workspace creation from Ever, by its idempotency key (unique `jti` too: one request never creates
 * under two keys).
 *
 * - `status`: `pending` (an attempt holds it until `claimedUntil`, renewed after each step), `created`
 *   or `failed` (`errorCode`); `everOrgKey` holds the Ever organization while pending or created
 *   (unique: one Ever organization is never created twice under two keys);
 * - the ids are filled step by step, so a creation that stopped is finished by its retry;
 * - `completionState`: the report to Ever Platform that the workspace exists (`pending`, `done`,
 *   `failed`), with its attempts and the next one; `tenantLinkId` is Ever Platform's id of the link.
 *
 * Times are epoch milliseconds. Created by the core `EverConnectProvision` migration; never exported.
 */
@SkipExport()
@ColumnIndex('IDX_ever_connect_provision_result_jti', ['jti'], { unique: true })
@ColumnIndex('IDX_ever_connect_provision_result_org', ['everOrgKey'], { unique: true })
@ColumnIndex('IDX_ever_connect_provision_result_completion', ['completionState', 'completionNextAt'])
@MultiORMEntity('ever_connect_provision_result')
export class EverConnectProvisionResult {
	@PrimaryKey({ type: 'varchar', length: 200 })
	@PrimaryColumn({ type: 'varchar', length: 200 })
	idempotencyKey: string;

	@MultiORMColumn({ type: 'varchar', length: 32 })
	jti: string;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	status: string;

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	everOrgId?: string | null;

	/** The Ever organization while this creation holds it (pending or created); empty once it failed. */
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	everOrgKey?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	productTenantId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	productOrgId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	productUserId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	employeeId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	teamId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	integrationTenantId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	errorCode?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	claimedBy?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	claimedUntil?: number | null;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	completionState?: string | null;

	@MultiORMColumn({ type: 'integer', default: 0 })
	completionAttempts: number;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	completionNextAt?: number | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	completionError?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	completedAt?: number | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	tenantLinkId?: string | null;

	@MultiORMColumn({ type: 'bigint' })
	createdAt: number;

	@MultiORMColumn({ type: 'bigint' })
	updatedAt: number;
}
