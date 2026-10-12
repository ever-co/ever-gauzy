import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * The operator's instance policy: one row per integration the operator allowed or denied in the
 * Ever Platform settings. A denied integration is off for every organization of the installation.
 * `EVER_CONNECT_INTEGRATIONS_DENY` is not stored here: it is read from the environment and wins.
 *
 * Created by the core `EverConnect` migration; never exported.
 */
@SkipExport()
@MultiORMEntity('ever_connect_policy')
export class EverConnectPolicy {
	@PrimaryKey({ type: 'varchar', length: 64 })
	@PrimaryColumn({ type: 'varchar', length: 64 })
	integration: string;

	@MultiORMColumn({ type: Boolean })
	allowed: boolean;

	/** `ui` (the operator's choice) or `default`. */
	@MultiORMColumn({ type: 'varchar', length: 16 })
	source: string;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	changedByUserId?: string | null;

	@MultiORMColumn({ type: 'bigint' })
	changedAt: number;
}
