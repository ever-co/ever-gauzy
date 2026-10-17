import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Between, FindOptionsOrder, FindOptionsWhere, MoreThanOrEqual } from 'typeorm';
import {
	DeadLetterStatus,
	ID,
	IJobDeadLetter,
	IJobDeadLetterDiscardInput,
	IJobDeadLetterFindInput,
	IJobDeadLetterRecordInput,
	IJobDeadLetterReplayInput,
	IPagination,
	JsonData
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { JobDeadLetter } from './job-dead-letter.entity';
import { TypeOrmJobDeadLetterRepository } from './repository/type-orm-job-dead-letter.repository';
import { MikroOrmJobDeadLetterRepository } from './repository/mikro-orm-job-dead-letter.repository';

/**
 * The inspectable dead-letter store, and the lifecycle an operator drives it through.
 *
 * Read the rules of this service as one rule with five faces.
 *
 * 1. **A row enters the store `NEW` and leaves it as `REPLAYED` or `DISCARDED`, and never as an
 *    absence.** There is deliberately **no delete path on this service**: a dead letter is the only
 *    record that a job failed, an operator's discard is a status change with a reason rather than a
 *    removal, and a store whose rows could be deleted would answer "what did we drop" with silence.
 *    The table has no retention either — that is the ledger's privilege, because a ledger row is a
 *    measurement past its window while a dead letter is an unhandled failure.
 * 2. **One failure is one row.** `(queueName, jobId)` is unique among live rows, so the retry of a
 *    failed write cannot record the same failure twice; a second `recordDeadLetter` for the same tuple
 *    answers with the row that is already there, because the caller's write is a retry and the store's
 *    answer must be the same one. A row without a job id is never deduplicated — the dialect treats
 *    `NULL` as distinct, and the platform does the same, because such a row names no job to compare.
 * 3. **A replay is a state change about something that already happened.** The enqueue is the queue
 *    layer's step and happens *before* this write: only the queue knows its policy and whether the
 *    queue is still declared, and a row marked `REPLAYED` before the enqueue would say a job was
 *    retried when nothing was. The fresh job id the enqueue produced is recorded on the row, and only
 *    a `NEW` row may be replayed — which is what makes "the same failure cannot be replayed twice
 *    unnoticed" true rather than aspirational.
 * 4. **A discard says why.** `discardedReason` is required and is the reason the discarded set is
 *    worth reading: an operator dropping a failure without a word is indistinguishable from a failure
 *    nobody looked at.
 * 5. **A failed write of a dead letter never swallows the original failure.** When the store cannot be
 *    written, the caller's failure is still the caller's — it logs the queue, the job name and the job
 *    id and lets the original error propagate. The queue's own failed set still holds the job at that
 *    moment, and losing the record must not also lose the failure.
 *
 * The tenancy columns are inherited from the base entity, and they are filled the only way they can be
 * on this path: a queue consumer runs with no request context, so the payload's own `tenantId` and
 * `organizationId` are read when the context has none. That is what makes a dead letter visible to the
 * tenant whose work failed without the queue layer having to know anything about the ledger's shape.
 */
@Injectable()
export class JobDeadLetterService extends TenantAwareCrudService<JobDeadLetter> {
	/** How much of a failure is kept, for the same reason the ledger bounds its own. */
	public static readonly MAX_ERROR_LENGTH = 8_192;

	/** How many rows one listing answers with when the caller states no limit. */
	public static readonly DEFAULT_PAGE_SIZE = 50;

	/** The upper bound on a listing, so one call cannot be asked for the whole store. */
	public static readonly MAX_PAGE_SIZE = 500;

	/** The oldest instant a window can start from, so a range is always expressible. */
	private static readonly EPOCH = new Date(0);

	constructor(
		readonly typeOrmJobDeadLetterRepository: TypeOrmJobDeadLetterRepository,
		readonly mikroOrmJobDeadLetterRepository: MikroOrmJobDeadLetterRepository
	) {
		super(typeOrmJobDeadLetterRepository, mikroOrmJobDeadLetterRepository);
	}

	/**
	 * The tenant and organization of the caller, which every operator read is scoped to.
	 *
	 * Both are null for the queue consumer that writes a row, and the writer falls back to the payload
	 * for that case — see {@link scopeOfPayload}.
	 */
	protected get scope(): { tenantId: ID | null; organizationId: ID | null } {
		return {
			tenantId: RequestContext.currentTenantId() ?? null,
			organizationId: RequestContext.currentOrganizationId() ?? null
		};
	}

	/**
	 * Records a job that exhausted its attempts.
	 *
	 * The row is created `NEW`: the two later states are written by the operator actions that observe
	 * them, and a body that states one is refused rather than silently ignored, because a caller that
	 * believes it recorded a replay has a bug it would otherwise never see.
	 *
	 * The write is idempotent on `(queueName, jobId)` for a job that has an id. A caller recording the
	 * same failure twice is retrying a write that may have failed on the way back, and answering with
	 * the row that is already there is both what the unique index requires and what the caller needs.
	 *
	 * @param input The queue, the job, its payload and how it failed.
	 * @returns The stored dead letter, `NEW` — or the one already recorded for that job.
	 * @throws BadRequestException `JOB_DEAD_LETTER_STATE_INVALID` when the queue name or the job name
	 * is missing, when no payload is presented, or when the attempt count is not a positive integer.
	 */
	async recordDeadLetter(input: IJobDeadLetterRecordInput): Promise<IJobDeadLetter> {
		const queueName = this.requireName(input?.queueName, 'queue');
		const jobName = this.requireName(input?.jobName, 'job');
		const jobId = this.normalizeName(input?.jobId);
		const attemptCount = this.requireAttemptCount(input?.attemptCount);

		if (input?.payload === undefined || input?.payload === null) {
			// An absent payload is refused rather than defaulted: the payload is what a replay
			// re-enqueues, so a row without one is a row that can only ever be discarded, and the
			// caller recording it is the one that can still fix that.
			throw new BadRequestException(
				`${ApiErrorCode.JOB_DEAD_LETTER_STATE_INVALID}: a dead letter carries the job's payload, because a replay re-enqueues exactly what failed, and none was presented.`
			);
		}

		if (jobId) {
			const existing = await this.findByQueueJob(queueName, jobId);

			if (existing) {
				return existing;
			}
		}

		const created = await this.create({
			queueName,
			jobName,
			...(jobId ? { jobId } : {}),
			payload: input.payload,
			status: DeadLetterStatus.NEW,
			attemptCount,
			failedAt: this.toInstant(input?.failedAt) ?? new Date(),
			...(input?.lastError !== undefined ? { lastError: this.bound(input.lastError) } : {}),
			...(input?.metadata !== undefined ? { metadata: input.metadata } : {}),
			...this.scopeOfPayload(input.payload)
		} as never);

		return created as IJobDeadLetter;
	}

	/**
	 * Reads one dead letter of the caller's scope, answering null when there is none.
	 *
	 * @param id The dead letter id.
	 * @returns The row, or null.
	 */
	async findDeadLetter(id: ID): Promise<IJobDeadLetter | null> {
		const rows: JobDeadLetter[] = await this.find({ where: { id, ...this.scope } } as never);

		return rows.length ? (rows[0] as IJobDeadLetter) : null;
	}

	/**
	 * Reads one dead letter of the caller's scope, or refuses.
	 *
	 * @param id The dead letter id.
	 * @returns The row.
	 * @throws NotFoundException `JOB_DEAD_LETTER_NOT_FOUND` when it does not exist inside the caller's
	 * scope.
	 */
	async findDeadLetterOrFail(id: ID): Promise<IJobDeadLetter> {
		const deadLetter = await this.findDeadLetter(id);

		if (!deadLetter) {
			throw new NotFoundException(`${ApiErrorCode.JOB_DEAD_LETTER_NOT_FOUND}: no such dead letter.`);
		}

		return deadLetter;
	}

	/**
	 * Lists the dead letters an operator may act on, newest failure first.
	 *
	 * Every filter is optional and the tenancy columns are not among them: the scope is the caller's.
	 * The default filter is the whole store rather than `NEW` alone, because "what did we drop, and
	 * why" is asked of the discarded rows as much as of the pending ones — an operator screen that
	 * wants only the queue uses the `status` filter, which is what {@link deadLetterDepth} does.
	 *
	 * @param filter Optional narrowing by queue, job name, status or failure window.
	 * @returns The page and the total the filter selects.
	 */
	async listDeadLetters(filter: IJobDeadLetterFindInput = {}): Promise<IPagination<IJobDeadLetter>> {
		const where = { ...this.scope, ...this.buildWhere(filter) } as FindOptionsWhere<JobDeadLetter>;
		const take = this.normalizePageSize(filter?.limit);
		const skip = this.normalizeOffset(filter?.offset);

		const items: JobDeadLetter[] = await this.find({
			where,
			order: { failedAt: 'DESC' } as FindOptionsOrder<JobDeadLetter>,
			take,
			skip
		} as never);
		const total = await this.count({ where } as never);

		return { items: items as IJobDeadLetter[], total };
	}

	/**
	 * How many failures of one queue nobody has dealt with yet.
	 *
	 * This is the `deadLetterDepth` the queue surface reports beside a queue's waiting, active and
	 * failed counts: the number of `NEW` rows for that queue, so an operator can tell a queue that is
	 * merely busy from one whose jobs are failing permanently.
	 *
	 * @param queueName The queue to measure.
	 * @returns The number of `NEW` rows for it.
	 */
	async deadLetterDepth(queueName: string): Promise<number> {
		return this.count({
			where: {
				...this.scope,
				queueName: this.requireName(queueName, 'queue'),
				status: DeadLetterStatus.NEW
			}
		} as never);
	}

	/**
	 * Records that a dead letter was put back on its queue.
	 *
	 * **The enqueue has already happened when this is called.** The caller — the queue layer, which
	 * owns the queue's policy, its declaration and its id generation — re-enqueued the stored payload
	 * with a fresh job id and hands that id in; this write then records the outcome. The order matters:
	 * a row marked first would claim a retry that might never have been enqueued, and a replay is only
	 * worth recording because it really happened.
	 *
	 * Only a `NEW` row may be replayed. A `REPLAYED` row refuses a second replay, which is how "the
	 * same failure cannot be replayed twice unnoticed" holds; a `DISCARDED` row refuses as well, because
	 * an operator's decision to drop a failure is not undone by a later replay of the same row — the
	 * job's payload is in the row and a genuinely new attempt is a new job, not a reopened decision.
	 *
	 * @param id The dead letter to mark.
	 * @param input The fresh job id the re-enqueue produced, and who performed it.
	 * @returns The stored row, `REPLAYED`.
	 * @throws BadRequestException `JOB_DEAD_LETTER_STATE_INVALID` when the row is not `NEW`, or when
	 * its payload is missing so there was nothing to re-enqueue.
	 * @throws NotFoundException when the row is not in the caller's scope.
	 */
	async replayDeadLetter(id: ID, input: IJobDeadLetterReplayInput = {}): Promise<IJobDeadLetter> {
		const deadLetter = await this.findDeadLetterOrFail(id);

		if (deadLetter.status !== DeadLetterStatus.NEW) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_DEAD_LETTER_STATE_INVALID}: this failure is already ${deadLetter.status}, and a replay is recorded once so that the same failure cannot be retried twice unnoticed.`
			);
		}

		if (deadLetter.payload === undefined || deadLetter.payload === null) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_DEAD_LETTER_STATE_INVALID}: a replay re-enqueues the stored payload, and this row carries none; discard it with a reason instead.`
			);
		}

		const replayedByUserId = this.normalizeName(input?.replayedByUserId) ?? this.currentUserId();
		const replayedJobId = this.normalizeName(input?.replayedJobId);

		await this.update(id, {
			status: DeadLetterStatus.REPLAYED,
			replayedAt: new Date(),
			...(replayedByUserId ? { replayedByUserId } : {}),
			// `jobId` keeps the id of the job that FAILED — it is half of the tuple that makes one
			// failure one row, and rewriting it would collide with the dead letter of the retry itself.
			// The id the replay enqueued is therefore recorded here, beside the rest of the detail.
			metadata: {
				...this.metadataOf(deadLetter.metadata),
				...(replayedJobId ? { replayedJobId } : {})
			}
		} as never);

		return this.findDeadLetterOrFail(id);
	}

	/**
	 * Records that a dead letter is not worth retrying.
	 *
	 * The reason is required and the row is kept: this is the one action that ends a failure's life
	 * without fixing it, and it is only defensible when it says why. A row that is already `DISCARDED`
	 * is refused rather than rewritten, for the same reason the ledger refuses a second outcome — the
	 * decision is a fact, and a second discard with a different reason would silently restate it.
	 *
	 * @param id The dead letter to discard.
	 * @param input Why it is being dropped, and who decided.
	 * @returns The stored row, `DISCARDED`.
	 * @throws BadRequestException `JOB_DEAD_LETTER_STATE_INVALID` when the reason is blank or when the
	 * row is not `NEW`.
	 * @throws NotFoundException when the row is not in the caller's scope.
	 */
	async discardDeadLetter(id: ID, input: IJobDeadLetterDiscardInput): Promise<IJobDeadLetter> {
		const deadLetter = await this.findDeadLetterOrFail(id);
		const reason = this.normalizeName(input?.reason);

		if (!reason) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_DEAD_LETTER_STATE_INVALID}: a discard is a decision, and a decision without a reason is indistinguishable from a failure nobody looked at.`
			);
		}

		if (deadLetter.status !== DeadLetterStatus.NEW) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_DEAD_LETTER_STATE_INVALID}: this failure is already ${deadLetter.status}, and a decision once taken is not restated.`
			);
		}

		const discardedByUserId = this.normalizeName(input?.discardedByUserId) ?? this.currentUserId();

		await this.update(id, {
			status: DeadLetterStatus.DISCARDED,
			discardedAt: new Date(),
			discardedReason: reason.slice(0, 255),
			// §3.22 declares no column for who discarded a row, and a name is not worth a second
			// column: the decision and its reason are the record, and the actor is kept beside them.
			...(discardedByUserId
				? {
						metadata: {
							...this.metadataOf(deadLetter.metadata),
							discardedByUserId
						}
					}
				: {})
		} as never);

		return this.findDeadLetterOrFail(id);
	}

	/**
	 * The live row already recorded for one queue and job, when there is one.
	 *
	 * The probe is scoped by the caller's tenancy for the ordinary case and unscoped when the caller
	 * has none, which is the queue consumer's case: the unique index that makes one failure one row is
	 * over `(queueName, jobId)` alone, so consulting it must ask the same question the index does.
	 *
	 * @param queueName The queue.
	 * @param jobId The job's id on that queue.
	 * @returns The existing row, or null.
	 */
	private async findByQueueJob(queueName: string, jobId: string): Promise<IJobDeadLetter | null> {
		const rows: JobDeadLetter[] = await this.find({ where: { queueName, jobId } } as never);

		return rows.length ? (rows[0] as IJobDeadLetter) : null;
	}

	/**
	 * The scope a row is written with.
	 *
	 * The request context wins when there is one — an operator recording a failure by hand is scoped to
	 * their own organization, and a caller must not be able to file a row under another's tenancy by
	 * composing a payload. When there is none, which is the queue consumer's ordinary case, the
	 * payload's own columns are read, because the producer is what recorded whose work the job was.
	 *
	 * @param payload The job's stored payload.
	 * @returns The tenancy to write.
	 */
	private scopeOfPayload(payload: JsonData): { tenantId: ID | null; organizationId: ID | null } {
		const fromContext = this.scope;

		if (fromContext.tenantId || fromContext.organizationId) {
			return fromContext;
		}

		const source = this.metadataOf(payload);

		return {
			tenantId: this.normalizeName(source.tenantId as string) ?? null,
			organizationId: this.normalizeName(source.organizationId as string) ?? null
		};
	}

	/**
	 * Builds the `where` a read narrows by, from a caller's filter.
	 *
	 * A window is expressed with `Between` and `MoreThanOrEqual` rather than with `LessThan`, for the
	 * reason the ledger states: the platform's TypeORM-to-MikroORM filter conversion understands a
	 * defined set of operators and `lessThan` is not one of them, so it degrades to *no filter* with a
	 * warning — turning "what failed in the last hour" into "everything that ever failed" on an
	 * installation running the other mapper.
	 *
	 * @param filter The caller's narrowing.
	 * @returns The conditions to merge into a read.
	 */
	private buildWhere(filter: IJobDeadLetterFindInput = {}): FindOptionsWhere<JobDeadLetter> {
		const where: FindOptionsWhere<JobDeadLetter> = {};

		if (filter.queueName) {
			where.queueName = filter.queueName;
		}

		if (filter.jobName) {
			where.jobName = filter.jobName;
		}

		if (filter.status) {
			where.status = filter.status;
		}

		const after = this.toInstant(filter.failedAfter);
		const before = this.toInstant(filter.failedBefore);

		if (after && before) {
			where.failedAt = Between(after, before);
		} else if (after) {
			where.failedAt = MoreThanOrEqual(after);
		} else if (before) {
			where.failedAt = Between(JobDeadLetterService.EPOCH, before);
		}

		return where;
	}

	/**
	 * A JSON column read as an object, whatever shape it arrived in.
	 *
	 * A JSON column is read whole and may come back as a string on a dialect that stores it as text.
	 * Treating that as "no metadata" would drop the detail a row already carries on the next write, so
	 * it is parsed here rather than assumed.
	 *
	 * @param value The stored value.
	 * @returns The object it holds, or an empty one.
	 */
	private metadataOf(value: JsonData | undefined): Record<string, unknown> {
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			return value as Record<string, unknown>;
		}

		if (typeof value === 'string' && value.trim().length > 0) {
			try {
				const parsed = JSON.parse(value);

				return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
					? (parsed as Record<string, unknown>)
					: {};
			} catch {
				return {};
			}
		}

		return {};
	}

	/**
	 * The caller's own user id, when there is one.
	 *
	 * A queue consumer has none, and the operator actions are the only ones that expect one: the row
	 * records who acted when somebody did, and stays silent rather than inventing an actor when nobody
	 * is in the request context.
	 *
	 * @returns The user id, or undefined.
	 */
	private currentUserId(): string | undefined {
		return this.normalizeName(RequestContext.currentUserId());
	}

	/**
	 * A required name, refused when it is missing or blank.
	 *
	 * @param value The stated value.
	 * @param label What the value names, for the message.
	 * @returns The trimmed, bounded value.
	 * @throws BadRequestException `JOB_DEAD_LETTER_STATE_INVALID` when it is missing or blank.
	 */
	private requireName(value: string | undefined, label: string): string {
		const normalized = this.normalizeName(value);

		if (!normalized) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_DEAD_LETTER_STATE_INVALID}: a dead letter names the ${label} it came from, and none was presented.`
			);
		}

		return normalized;
	}

	/**
	 * The attempt count a row carries: at least 1, because a job that never ran has not failed.
	 *
	 * @param value The stated count.
	 * @returns The count to store.
	 * @throws BadRequestException `JOB_DEAD_LETTER_STATE_INVALID` when it is not a positive integer.
	 */
	private requireAttemptCount(value?: number): number {
		if (!Number.isInteger(value) || (value as number) < 1) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_DEAD_LETTER_STATE_INVALID}: a job reaches the dead-letter store after exhausting its attempts, so the attempt count is a whole number from 1, and '${String(value)}' is not one.`
			);
		}

		return value as number;
	}

	/**
	 * A trimmed, bounded name, or undefined when there is nothing to record.
	 *
	 * @param value The stated value.
	 * @returns The normalized value, or undefined.
	 */
	private normalizeName(value?: string): string | undefined {
		if (value === undefined || value === null) {
			return undefined;
		}

		const trimmed = String(value).trim();

		return trimmed.length > 0 ? trimmed.slice(0, 128) : undefined;
	}

	/**
	 * A bounded failure text.
	 *
	 * @param value The stated text.
	 * @returns The text, truncated to the column's documented budget.
	 */
	private bound(value: string): string {
		return String(value).slice(0, JobDeadLetterService.MAX_ERROR_LENGTH);
	}

	/**
	 * A stated instant, or undefined when the caller stated none.
	 *
	 * @param value The stated instant.
	 * @returns The instant, or undefined.
	 */
	private toInstant(value?: Date | string): Date | undefined {
		if (value === undefined || value === null) {
			return undefined;
		}

		const instant = value instanceof Date ? value : new Date(value);

		return Number.isNaN(instant.getTime()) ? undefined : instant;
	}

	/**
	 * A page size inside the documented bound.
	 *
	 * @param limit The stated limit.
	 * @returns The size to read with.
	 */
	private normalizePageSize(limit?: number): number {
		if (limit === undefined || limit === null || !Number.isFinite(limit) || limit <= 0) {
			return JobDeadLetterService.DEFAULT_PAGE_SIZE;
		}

		return Math.min(Math.floor(limit), JobDeadLetterService.MAX_PAGE_SIZE);
	}

	/**
	 * A row offset that is never negative.
	 *
	 * @param offset The stated offset.
	 * @returns The offset to read from.
	 */
	private normalizeOffset(offset?: number): number {
		if (offset === undefined || offset === null || !Number.isFinite(offset) || offset <= 0) {
			return 0;
		}

		return Math.floor(offset);
	}
}
