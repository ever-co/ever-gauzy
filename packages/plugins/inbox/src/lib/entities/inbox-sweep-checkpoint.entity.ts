import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * `inbox_sweep_checkpoint`: where a recovery sweep of the Inbox stands, one row per sweep (`id`, its name; migration
 * 1791000006540). The notification filing's sweep (`InboxNotificationSweepService`) keeps the last notification it
 * settled, in the order it reads them (`cursorAt`, then `cursorId`), and the notification it has not managed to file
 * yet with the number of sweeps that tried (`heldId`, `heldAttempts`).
 *
 * Not tenant data — one row for the installation — so never exported. The date columns are typed `?: Date`, not
 * `Date | null` (see `InboxItem`).
 */
@SkipExport()
@MultiORMEntity('inbox_sweep_checkpoint')
export class InboxSweepCheckpoint {
	// Both ORMs get the primary key whichever one is active (Gauzy initializes both).
	@PrimaryKey({ type: 'varchar', length: 64 })
	@PrimaryColumn({ type: 'varchar', length: 64 })
	id!: string;

	@MultiORMColumn({ nullable: true })
	cursorAt?: Date;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	cursorId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	heldId?: string | null;

	@MultiORMColumn({ type: 'int', default: 0 })
	heldAttempts!: number;

	@MultiORMColumn({ nullable: true })
	updatedAt?: Date;
}
