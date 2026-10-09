import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * Reserved for the counterparty check ("is this client or supplier on Ever Platform?"): salted
 * hashes and their answers, per organization, for a day (a negative answer for an hour). The check
 * is not available yet (its integration reads "coming soon"), so the table stays empty.
 *
 * Created by the core `EverConnect` migration; never exported.
 */
@SkipExport()
@ColumnIndex('IDX_ever_connect_lookup_cache_key', ['organizationId', 'kind', 'hash'], { unique: true })
@MultiORMEntity('ever_connect_lookup_cache')
export class EverConnectLookupCache {
	@PrimaryKey({ type: 'varchar', length: 36 })
	@PrimaryColumn({ type: 'varchar', length: 36 })
	id: string;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	tenantId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 36 })
	organizationId: string;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	kind: string;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	hash: string;

	@MultiORMColumn({ type: 'varchar', length: 32 })
	saltVersion: string;

	@MultiORMColumn({ type: 'text', nullable: true })
	result?: string | null;

	@MultiORMColumn({ type: 'bigint' })
	expiresAt: number;
}
