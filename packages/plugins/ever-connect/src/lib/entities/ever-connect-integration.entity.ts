import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * The local state of one integration: for the whole installation (`scope = 'instance'`, the
 * installation-wide keys) or for one tenant link (`scope` = the link id). Nothing moves for an
 * integration unless Ever Platform holds a consent for it and this row is `enabled`.
 *
 * - `state`: `available`, `enabled`, `disabled`, `denied_by_policy`, `revoked_remote`,
 *   `coming_soon`, or `pending_operator` (an installation-wide integration the connecting
 *   organization consented to, waiting for the operator's local accept).
 * - `revokeSource`: `instance`, `platform`, `env`, `policy` or `operator`.
 * - `configEncrypted`: an integration's configuration, stored encrypted (none in this release).
 *
 * Times are epoch milliseconds. Created by the core `EverConnect` migration; never exported.
 */
@SkipExport()
@ColumnIndex('IDX_ever_connect_integration_scope_name', ['scope', 'name'], { unique: true })
@ColumnIndex('IDX_ever_connect_integration_organization', ['tenantId', 'organizationId'])
@MultiORMEntity('ever_connect_integration')
export class EverConnectIntegration {
	@PrimaryKey({ type: 'varchar', length: 36 })
	@PrimaryColumn({ type: 'varchar', length: 36 })
	id: string;

	/** `instance`, or the tenant link id. */
	@MultiORMColumn({ type: 'varchar', length: 40 })
	scope: string;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	name: string;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	tenantId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	organizationId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	integrationTenantId?: string | null;

	@MultiORMColumn({ type: 'integer', nullable: true })
	scopeVersion?: number | null;

	@MultiORMColumn({ type: Boolean, default: false })
	enabled: boolean;

	@MultiORMColumn({ type: 'varchar', length: 24 })
	state: string;

	/** `pending`, `accepted` or `declined` for an installation-wide integration; else empty. */
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	operatorAccept?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	consentId?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	consentedAt?: number | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	consentedByLabel?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 24, nullable: true })
	consentSource?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	termsVersion?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	dpaVersion?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	revokedAt?: number | null;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	revokeSource?: string | null;

	/** Switched off here while Ever Platform could not be told; retried at the next heartbeat. */
	@MultiORMColumn({ type: Boolean, default: false })
	pendingRemoteRevoke: boolean;

	@MultiORMColumn({ type: 'text', nullable: true, hidden: true })
	configEncrypted?: string | null;

	@MultiORMColumn({ type: 'bigint' })
	createdAt: number;

	@MultiORMColumn({ type: 'bigint' })
	updatedAt: number;
}
