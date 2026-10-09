import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * The append-only record of what happened to the Ever Platform connection: connect, disconnect,
 * links, consents, integrations switched on and off, entitlement refreshes, policy changes.
 *
 * `details` is JSON with ids and states only (an allow-list of keys): never a code, a token, a key,
 * an address, an e-mail, an IP address or a user agent. `actorLabel` names the actor without
 * personal data (`user`, `operator`, `platform`, `env:EVER_CONNECT_CODE`, `system`).
 *
 * Nothing updates or deletes a row. Times are epoch milliseconds. Created by the core `EverConnect`
 * migration; never exported.
 */
@SkipExport()
@ColumnIndex('IDX_ever_connect_audit_organization_at', ['tenantId', 'organizationId', 'at'])
@ColumnIndex('IDX_ever_connect_audit_at', ['at'])
@MultiORMEntity('ever_connect_audit')
export class EverConnectAudit {
	@PrimaryKey({ type: 'varchar', length: 36 })
	@PrimaryColumn({ type: 'varchar', length: 36 })
	id: string;

	@MultiORMColumn({ type: 'bigint' })
	at: number;

	/** Empty for an action on the whole installation. */
	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	tenantId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	organizationId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	actorUserId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	actorLabel: string;

	@MultiORMColumn({ type: 'varchar', length: 48 })
	action: string;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	integration?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	details?: string | null;
}
