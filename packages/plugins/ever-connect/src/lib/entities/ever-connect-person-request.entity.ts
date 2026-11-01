import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * One deletion or export request of a person received from Ever Platform (`id` = the event's id),
 * and the answer this installation gives (`POST /v1/instances/me/ack`). A request read twice is
 * answered once.
 *
 * - `kind`: `deletion` or `export`.
 * - `subjectHashes`: the identities the request names (JSON, `sha256(<issuer>#<subject>)` each);
 *   `userIds`: the Gauzy users linked to them, kept before any link is removed (JSON), so a request
 *   handled again after a failure answers for the same accounts; `claimedBy` / `claimedUntil`:
 *   the handling that holds it, renewed while it runs; only that handling writes the answer.
 * - `result`: `deleted`, `anonymised`, `retained_legal`, `no_account`, `exported` or `failed`, with
 *   `reasonCode` (a machine token) for `failed` and `legalBasis` for `retained_legal`.
 * - `exportUrlEncrypted`: the link to this installation's own export, stored encrypted.
 * - `state`: `pending` (the answer waits to be sent, at `nextAttemptAt`), `answered`, or `rejected`
 *   (Ever Platform refused it for good; `lastError` says why, as a code).
 *
 * Times are epoch milliseconds. Created by the core `EverConnectIdentity` migration; never exported.
 */
@SkipExport()
@ColumnIndex('IDX_ever_connect_person_request_due', ['state', 'nextAttemptAt'])
@ColumnIndex('IDX_ever_connect_person_request_job', ['jobId'])
@MultiORMEntity('ever_connect_person_request')
export class EverConnectPersonRequest {
	@PrimaryKey({ type: 'varchar', length: 32 })
	@PrimaryColumn({ type: 'varchar', length: 32 })
	id: string;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	kind: string;

	@MultiORMColumn({ type: 'varchar', length: 32 })
	jobId: string;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	respondBy?: number | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	subjectHashes?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	userIds?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	claimedBy?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	claimedUntil?: number | null;

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	result?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	reasonCode?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 200, nullable: true })
	legalBasis?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true, hidden: true })
	exportUrlEncrypted?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	state: string;

	@MultiORMColumn({ type: 'integer', default: 0 })
	attempts: number;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	nextAttemptAt?: number | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	lastError?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	answeredAt?: number | null;

	@MultiORMColumn({ type: 'bigint' })
	createdAt: number;

	@MultiORMColumn({ type: 'bigint' })
	updatedAt: number;
}
