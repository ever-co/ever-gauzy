import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * One Gauzy organization linked to one Ever organization (a tenant link). Gauzy's own record of the
 * link is the `integration_tenant` row named `Ever_Connect` (`integrationTenantId`), with the link
 * id, the Ever organization, its handle and the link status as its settings; this row keeps what
 * does not fit there: the link's entitlement document, stored encrypted.
 *
 * Times are epoch milliseconds. Created by the core `EverConnect` migration; never exported.
 */
@SkipExport()
@ColumnIndex('IDX_ever_connect_link_organization', ['tenantId', 'organizationId'])
@ColumnIndex('IDX_ever_connect_link_link_id', ['linkId'], { unique: true })
@MultiORMEntity('ever_connect_link')
export class EverConnectLink {
	@PrimaryKey({ type: 'varchar', length: 36 })
	@PrimaryColumn({ type: 'varchar', length: 36 })
	id: string;

	@MultiORMColumn({ type: 'varchar', length: 36 })
	tenantId: string;

	@MultiORMColumn({ type: 'varchar', length: 36 })
	organizationId: string;

	/** The Gauzy `integration_tenant` row of this link. */
	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	integrationTenantId?: string | null;

	/** The tenant link id on Ever Platform (a ULID). */
	@MultiORMColumn({ type: 'varchar', length: 32 })
	linkId: string;

	@MultiORMColumn({ type: 'varchar', length: 32 })
	everOrgId: string;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	everHandle?: string | null;

	/** `linked`, `suspended`, `orphaned` or `unlinked`. */
	@MultiORMColumn({ type: 'varchar', length: 16 })
	status: string;

	@MultiORMColumn({ type: 'text', nullable: true, hidden: true })
	entitlementJwsEncrypted?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	entitlementSeq?: number | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	entitlementIat?: number | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	entitlementExp?: number | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	entitlementFetchedAt?: number | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	linkedByUserId?: string | null;

	@MultiORMColumn({ type: 'bigint' })
	createdAt: number;

	@MultiORMColumn({ type: 'bigint' })
	updatedAt: number;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	unlinkedAt?: number | null;
}
