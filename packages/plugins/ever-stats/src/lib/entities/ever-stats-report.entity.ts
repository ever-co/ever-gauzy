import { ColumnIndex, MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * One report this installation built: the exact bytes it signed and sent (`payload`, stored as text so
 * nothing re-orders or re-spaces them), the result (`pending`, `sent`, `rejected`, `failed`), the HTTP
 * status and the attempts. The plugin keeps the last 12. Times are epoch milliseconds.
 *
 * The table is created by the core `EverStatsReport` migration; it never leaves the installation.
 */
@SkipExport()
@ColumnIndex('IDX_ever_stats_report_created_at', ['createdAt'])
@MultiORMEntity('ever_stats_report')
export class EverStatsReport {
	@MultiORMColumn({ primary: true, type: 'varchar', length: 36 })
	id: string;

	@MultiORMColumn({ type: 'varchar', length: 7 })
	period: string;

	@MultiORMColumn({ type: 'text', nullable: true })
	payload?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	status: string;

	@MultiORMColumn({ type: 'integer', nullable: true })
	httpStatus?: number | null;

	@MultiORMColumn({ type: 'integer', default: 0 })
	attempts: number;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	lastError?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	sentAt?: number | null;

	@MultiORMColumn({ type: 'bigint' })
	createdAt: number;
}
