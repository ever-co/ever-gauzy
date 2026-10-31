import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * One Ever ID link (`op = 'link'`) or unlink (`op = 'unlink'`) of a Gauzy user, waiting to be
 * reported to Ever Platform while Sign in with Ever ID is enabled (a retry table).
 *
 * - `state`: `pending` (sent by the API process holding the connection's lease, at `nextAttemptAt`),
 *   `sent`, `failed` (given up after a day of retries; audited) or `dropped` (nothing to send any
 *   more, for example the integration was switched off).
 * - `subjectHash`: `sha256(<issuer>#<subject>)`, as Ever Platform names an identity in a deletion or
 *   export request.
 * - `origin`: `event` (a link or unlink just made), `backfill` (a link that existed before, reported
 *   once) or `repair` (reported again after an unlink of the same user).
 * - `lastError`: a code, never a value.
 * - `createdAt` (when the link or unlink happened) and `seq` (one more than the user's previous
 *   report) order one user's reports: they are sent in that order.
 *
 * Identifiers and the tenant's display name only: never an e-mail address or a person's name. Times
 * are epoch milliseconds. Created by the core `EverConnectIdentity` migration; never exported.
 */
@SkipExport()
@ColumnIndex('IDX_ever_connect_person_link_report_due', ['state', 'nextAttemptAt'])
@ColumnIndex('IDX_ever_connect_person_link_report_subject', ['subjectHash'])
@ColumnIndex('IDX_ever_connect_person_link_report_user', ['userId', 'state'])
@MultiORMEntity('ever_connect_person_link_report')
export class EverConnectPersonLinkReport {
	@PrimaryKey({ type: 'varchar', length: 36 })
	@PrimaryColumn({ type: 'varchar', length: 36 })
	id: string;

	/** `link` or `unlink`. */
	@MultiORMColumn({ type: 'varchar', length: 8 })
	op: string;

	/** `event`, `backfill` or `repair`. */
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	origin?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	userId: string;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	tenantId?: string | null;

	/** The tenant's display name (never a person's name). */
	@MultiORMColumn({ type: 'varchar', length: 120, nullable: true })
	tenantName?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 255 })
	issuer: string;

	@MultiORMColumn({ type: 'varchar', length: 128 })
	subject: string;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	subjectHash: string;

	/** `explicit` or `confirmed`. */
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	linkMethod?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	state: string;

	@MultiORMColumn({ type: 'integer', default: 0 })
	attempts: number;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	nextAttemptAt?: number | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	lastError?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	sentAt?: number | null;

	@MultiORMColumn({ type: 'integer', default: 0 })
	seq: number;

	@MultiORMColumn({ type: 'bigint' })
	createdAt: number;

	@MultiORMColumn({ type: 'bigint' })
	updatedAt: number;
}
