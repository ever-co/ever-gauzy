import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * One signed request from Ever Platform to create a workspace (`jti`, the request's id), kept while
 * the person signs in with Ever ID and confirms.
 *
 * - `intent`: the verified claims as JSON (ids and public names only, never an e-mail);
 * - `keyHash`: the SHA-256 (hex) of the one-time key the browser holds meanwhile; the key itself is
 *   never stored;
 * - `status`: `pending`, `accepted`, `rejected` or `expired`; `result`: the ids created (JSON).
 *
 * Times are epoch milliseconds. Created by the core `EverConnectProvision` migration; never exported.
 */
@SkipExport()
@ColumnIndex('IDX_ever_connect_provision_intent_key', ['keyHash'], { unique: true })
@ColumnIndex('IDX_ever_connect_provision_intent_expires', ['expiresAt'])
@MultiORMEntity('ever_connect_provision_intent')
export class EverConnectProvisionIntent {
	@PrimaryKey({ type: 'varchar', length: 32 })
	@PrimaryColumn({ type: 'varchar', length: 32 })
	jti: string;

	@MultiORMColumn({ type: 'text', nullable: true })
	intent?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64, hidden: true })
	keyHash: string;

	@MultiORMColumn({ type: 'varchar', length: 200 })
	idempotencyKey: string;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	status: string;

	@MultiORMColumn({ type: 'text', nullable: true })
	result?: string | null;

	@MultiORMColumn({ type: 'bigint' })
	receivedAt: number;

	@MultiORMColumn({ type: 'bigint' })
	expiresAt: number;

	@MultiORMColumn({ type: 'bigint' })
	updatedAt: number;
}
