import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * One row (`id = 'sender'`) that lets a single API process send at a time when several share the
 * database: a process takes it with a compare-and-set update and holds it for 15 minutes.
 * `lastSentAt` is the last accepted report, so a second process does not send the same day again.
 * Times are epoch milliseconds. Created by the core `EverStatsReport` migration.
 */
@SkipExport()
@MultiORMEntity('ever_stats_lease')
export class EverStatsLease {
	// Both ORMs get the primary key whichever one is active (Gauzy initializes both).
	@PrimaryKey({ type: 'varchar', length: 16 })
	@PrimaryColumn({ type: 'varchar', length: 16 })
	id: string;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	leasedBy?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	leaseUntil?: number | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	lastSentAt?: number | null;
}
