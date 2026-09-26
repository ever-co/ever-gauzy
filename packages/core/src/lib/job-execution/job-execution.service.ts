import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Between, FindOptionsOrder, FindOptionsWhere, In, MoreThanOrEqual } from 'typeorm';
import {
	ID,
	IJobExecution,
	IJobExecutionBeginInput,
	IJobExecutionFindInput,
	IJobExecutionFinishInput,
	IJobExecutionSkipOverlapInput,
	IPagination,
	JobExecutionStatus,
	JobTrigger
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { JobExecution } from './job-execution.entity';
import { TypeOrmJobExecutionRepository } from './repository/type-orm-job-execution.repository';
import { MikroOrmJobExecutionRepository } from './repository/mikro-orm-job-execution.repository';

/**
 * The scheduler's run ledger, and the rules that make a row a fact rather than a status field.
 *
 * Read the rules of this service as one rule with six faces.
 *
 * 1. **A run is opened `RUNNING` and closed once.** `beginRun` writes the row, `finishRun` (or
 *    `cancelRun`, its one-outcome shorthand) closes it, and a row that is already closed is refused
 *    rather than rewritten. That is what keeps "how did this run end" one answer per attempt, and it
 *    is why the service refuses a `finishRun` that reports `RUNNING`: the state a run is *in* is not
 *    an outcome a caller reports.
 * 2. **`finishedAt` is non-null exactly when the attempt is over.** `beginRun` writes none, every
 *    closing write stamps one, and `durationMs` is derived from the two instants when the caller
 *    states none. There is no path through this service that leaves a finished run without a finish
 *    instant or an open run with one.
 * 3. **One live run per job and scope.** A second `beginRun` for the same job, tenant and
 *    organization is refused with the live run's id, because that refusal is the signal the caller
 *    turns into a `SKIPPED_OVERLAP` row. Two live rows for one job would make "is it running" two
 *    answers, and the ledger exists to make it one.
 * 4. **A stale live run is closed, not ignored.** A worker killed mid-pass leaves a `RUNNING` row
 *    behind, and a rule that refused every later tick until an operator noticed would turn one lost
 *    process into a job that never runs again. A live run older than the staleness window is
 *    therefore closed as `CANCELLED` with the reason recorded, and the new tick proceeds — the row
 *    stays visible and says it was interrupted, which is the fact worth keeping.
 * 5. **`SKIPPED_OVERLAP` is a row, not silence.** A tick that could not start is recorded with the
 *    instant the tick was observed and no node, because nothing ran on any node, and the reason is
 *    written where an operator reads it rather than only inside JSON. "The job did not run" and "the
 *    job ran and did nothing" are different facts.
 * 6. **Attempts are counted, never decremented.** A retrying job writes one row per attempt; the
 *    count is 1-based, a closing write may raise it to the attempt the run ended on, and a write that
 *    would lower it is refused because it would make the ledger's own history a lie.
 *
 * Retention is the one hard delete this table has, and it is deliberately narrow: rows older than the
 * configured window **that are over**. A live row is never purged by age, because the row is the only
 * evidence that a run was interrupted, and deleting it would erase exactly what an operator needs to
 * see. What ends such a row is a closing write — the reclaim above, or an operator's cancellation.
 */
@Injectable()
export class JobExecutionService extends TenantAwareCrudService<JobExecution> {
	/**
	 * Statuses a run can end in. `RUNNING` is deliberately absent: it is the state a run holds while
	 * it is in flight and never an outcome.
	 */
	private static readonly TERMINAL_STATUSES: JobExecutionStatus[] = [
		JobExecutionStatus.SUCCEEDED,
		JobExecutionStatus.FAILED,
		JobExecutionStatus.CANCELLED,
		JobExecutionStatus.SKIPPED_OVERLAP
	];

	/**
	 * The window after which a live row is treated as an interrupted run rather than a running one.
	 *
	 * Sixty seconds, which is the scheduler's own default lock lifetime when a job declares no
	 * timeout. It is a default and not a law: a caller that knows its job's timeout passes that
	 * instead, so a legitimately long pass is never reclaimed out from under itself.
	 */
	public static readonly STALE_RUN_TTL_MS = 60_000;

	/**
	 * How much of a failure is kept. A stack trace is evidence and not a document: the first lines
	 * name the throw site, and the rest is a large blob that makes every listing slower to read.
	 */
	public static readonly MAX_ERROR_LENGTH = 8_192;

	/** How many rows one listing answers with when the caller states no limit. */
	public static readonly DEFAULT_PAGE_SIZE = 50;

	/** The upper bound on a listing, so one call cannot be asked for the whole ledger. */
	public static readonly MAX_PAGE_SIZE = 500;

	/** The oldest instant the retention window can start from, so a range is always expressible. */
	private static readonly EPOCH = new Date(0);

	constructor(
		readonly typeOrmJobExecutionRepository: TypeOrmJobExecutionRepository,
		readonly mikroOrmJobExecutionRepository: MikroOrmJobExecutionRepository
	) {
		super(typeOrmJobExecutionRepository, mikroOrmJobExecutionRepository);
	}

	/**
	 * The tenant and organization of the caller, which the ledger's live-run rule is scoped by.
	 *
	 * Both are null for a scheduled pass, which runs with no request context: a platform-wide pass is
	 * the ordinary case here rather than an anomaly, and its rows are read by a global operator
	 * surface rather than by a tenant-scoped one. A fan-out child states its partition, so a per-tenant
	 * pass is scoped to the tenant it ran for.
	 */
	protected get scope(): { tenantId: ID | null; organizationId: ID | null } {
		return {
			tenantId: RequestContext.currentTenantId() ?? null,
			organizationId: RequestContext.currentOrganizationId() ?? null
		};
	}

	/**
	 * Opens an attempt: writes the `RUNNING` row a later write closes.
	 *
	 * The status is not a parameter. A run begins `RUNNING` and nowhere else, which is what makes
	 * "`finishedAt` is null exactly while the run is open" true of the stored rows rather than merely
	 * of the happy path.
	 *
	 * A live run of the same job and scope blocks this call — that is the refusal the caller records
	 * as `SKIPPED_OVERLAP` — **unless** it is older than the staleness window, in which case it is
	 * closed first as an interrupted run. The reclaim is here rather than in the caller because the
	 * ledger is what knows the row's age, and a caller that had to decide it would be deciding it from
	 * a read that another instance can invalidate between the read and the write.
	 *
	 * @param input The job, the attempt and the instance the attempt runs on.
	 * @param staleAfterMs How old a live row of the same job must be to count as interrupted.
	 * @returns The stored run, `RUNNING`.
	 * @throws BadRequestException `JOB_EXECUTION_STATE_INVALID` when the job id is missing or the
	 * attempt count is not a positive integer.
	 * @throws ConflictException `JOB_EXECUTION_ALREADY_RUNNING` when a live run of the same job and
	 * scope is still in flight.
	 */
	async beginRun(
		input: IJobExecutionBeginInput,
		staleAfterMs: number = JobExecutionService.STALE_RUN_TTL_MS
	): Promise<IJobExecution> {
		const jobId = this.requireJobId(input?.jobId);
		const jobName = this.normalizeName(input?.jobName) ?? jobId;
		const attemptCount = this.normalizeAttemptCount(input?.attemptCount);
		const startedAt = this.toInstant(input?.startedAt) ?? new Date();

		const live = await this.findLiveRuns(jobId);
		const window = this.effectiveWindow(staleAfterMs);

		for (const run of live) {
			if (this.isStale(run, startedAt, window)) {
				await this.closeStaleRun(run, startedAt, window);
			}
		}

		const stillLive = (await this.findLiveRuns(jobId))[0];

		if (stillLive) {
			throw new ConflictException(
				`${ApiErrorCode.JOB_EXECUTION_ALREADY_RUNNING}: job '${jobId}' is already running as run '${stillLive.id}', so this attempt was not opened.`
			);
		}

		const created = await this.create({
			jobId,
			jobName,
			trigger: input?.trigger ?? JobTrigger.SCHEDULED,
			status: JobExecutionStatus.RUNNING,
			attemptCount,
			startedAt,
			nodeId: this.normalizeName(input?.nodeId),
			...(input?.metadata !== undefined ? { metadata: input.metadata } : {}),
			...this.scope
		} as never);

		return created as IJobExecution;
	}

	/**
	 * Closes a run with its outcome.
	 *
	 * The write stamps the finish instant, derives the duration from the two instants when the caller
	 * states none, and records the failure. It is the only path by which a run stops being `RUNNING`
	 * other than {@link cancelRun}, and it refuses a run that is already closed: a ledger row that can
	 * be rewritten is a ledger that cannot answer what happened.
	 *
	 * @param id The run to close.
	 * @param input How the attempt ended.
	 * @returns The stored run.
	 * @throws BadRequestException `JOB_EXECUTION_STATE_INVALID` when the outcome is missing, is
	 * `RUNNING`, when the run is already closed, or when the stated attempt count would lower the
	 * run's own count.
	 * @throws NotFoundException `JOB_EXECUTION_NOT_FOUND` when the run is not in the caller's scope.
	 */
	async finishRun(id: ID, input: IJobExecutionFinishInput): Promise<IJobExecution> {
		const run = await this.findRunOrFail(id);
		const status = input?.status;

		if (!status || status === JobExecutionStatus.RUNNING) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_EXECUTION_STATE_INVALID}: a run is closed with an outcome, and '${String(status)}' is not one.`
			);
		}

		if (!JobExecutionService.TERMINAL_STATUSES.includes(status)) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_EXECUTION_STATE_INVALID}: '${status}' is not a status a run can end in.`
			);
		}

		if (run.status !== JobExecutionStatus.RUNNING) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_EXECUTION_STATE_INVALID}: run '${run.id}' already ended as ${run.status}, and an ended run is a fact rather than a field.`
			);
		}

		const finishedAt = this.toInstant(input?.finishedAt) ?? new Date();
		const durationMs = this.resolveDuration(run, input?.durationMs, finishedAt);
		const attemptCount = input?.attemptCount ?? run.attemptCount;

		if (!Number.isInteger(attemptCount) || attemptCount < run.attemptCount) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_EXECUTION_STATE_INVALID}: run '${run.id}' began as attempt ${run.attemptCount} and cannot end as attempt ${String(input?.attemptCount)}.`
			);
		}

		await this.update(id, {
			status,
			finishedAt,
			durationMs,
			attemptCount,
			...(input?.lastError !== undefined ? { lastError: this.bound(input.lastError) } : {}),
			...(input?.metadata !== undefined ? { metadata: input.metadata } : {})
		} as never);

		return this.findRunOrFail(id);
	}

	/**
	 * Closes a run that will not finish on its own.
	 *
	 * The operator's act, and the reclaim path's, in one place: a run whose process died, or a manual
	 * run an operator wants stopped, is closed `CANCELLED` with the reason recorded. It is a thin
	 * wrapper over {@link finishRun} on purpose — cancellation is an outcome like any other, and a
	 * second closing path that could disagree with the first is how the ledger's one-outcome rule
	 * would stop being true.
	 *
	 * @param id The run to cancel.
	 * @param reason Why it was cancelled. Recorded; a cancellation without a reason is a fact nobody
	 * can act on later.
	 * @returns The stored run, `CANCELLED`.
	 * @throws NotFoundException when the run is not in the caller's scope.
	 */
	async cancelRun(id: ID, reason?: string): Promise<IJobExecution> {
		return this.finishRun(id, {
			status: JobExecutionStatus.CANCELLED,
			...(reason !== undefined ? { lastError: reason } : {})
		});
	}

	/**
	 * Records a tick that could not start, as a row rather than as silence.
	 *
	 * The row is written with the instant the tick was observed as both its start and its finish, no
	 * duration and **no node**: nothing ran, on any instance, and a node id would claim otherwise. The
	 * reason goes into `lastError`, which is the column an operator reads, and the caller's structured
	 * detail into `metadata`.
	 *
	 * This is deliberately a write of its own rather than something {@link beginRun} does when it
	 * refuses: the refusal and the record are two different acts by two different callers, and a
	 * `beginRun` that silently wrote a skip row would make the refusal unobservable to the caller that
	 * wanted to log it.
	 *
	 * @param input The job whose tick was skipped, and why.
	 * @returns The stored run, `SKIPPED_OVERLAP`.
	 * @throws BadRequestException `JOB_EXECUTION_STATE_INVALID` when the job id is missing.
	 */
	async recordSkippedOverlap(input: IJobExecutionSkipOverlapInput): Promise<IJobExecution> {
		const jobId = this.requireJobId(input?.jobId);
		const jobName = this.normalizeName(input?.jobName) ?? jobId;
		const observedAt = new Date();
		const reason =
			this.normalizeName(input?.reason) ??
			`another run of '${jobId}' was still in flight when the tick fired`;

		const created = await this.create({
			jobId,
			jobName,
			trigger: input?.trigger ?? JobTrigger.SCHEDULED,
			status: JobExecutionStatus.SKIPPED_OVERLAP,
			attemptCount: this.normalizeAttemptCount(input?.attemptCount),
			startedAt: observedAt,
			finishedAt: observedAt,
			durationMs: 0,
			nodeId: null,
			lastError: this.bound(reason),
			metadata: input?.metadata ?? { skipped: true, reason },
			...this.scope
		} as never);

		return created as IJobExecution;
	}

	/**
	 * Reads one run of the caller's scope, answering null when there is none.
	 *
	 * The answering form exists because a caller deciding what to do about a missing run — a health
	 * surface, an operator screen that has outlived its row — treats the miss as an ordinary fact,
	 * while {@link findRunOrFail} is for a caller handed an identifier it must honour.
	 *
	 * @param id The run id.
	 * @returns The run, or null.
	 */
	async findRun(id: ID): Promise<IJobExecution | null> {
		const runs: JobExecution[] = await this.find({ where: { id, ...this.scope } } as never);

		return runs.length ? (runs[0] as IJobExecution) : null;
	}

	/**
	 * Reads one run of the caller's scope, or refuses.
	 *
	 * @param id The run id.
	 * @returns The run.
	 * @throws NotFoundException `JOB_EXECUTION_NOT_FOUND` when it does not exist inside the caller's
	 * scope.
	 */
	async findRunOrFail(id: ID): Promise<IJobExecution> {
		const run = await this.findRun(id);

		if (!run) {
			throw new NotFoundException(`${ApiErrorCode.JOB_EXECUTION_NOT_FOUND}: no such run in the ledger.`);
		}

		return run;
	}

	/**
	 * The live run of a job in the caller's scope, when there is one.
	 *
	 * "Live" means `RUNNING`, and it is an indexed probe rather than a scan: the partial index over
	 * `(status, startedAt)` holds only open rows, so this read stays small however long the ledger
	 * grows.
	 *
	 * @param jobId The job to probe.
	 * @returns The live run — the newest, when an interrupted one has not been reclaimed yet — or null.
	 */
	async findLiveRun(jobId: string): Promise<IJobExecution | null> {
		const runs = await this.findLiveRuns(this.requireJobId(jobId));

		return runs.length ? runs[0] : null;
	}

	/**
	 * Every live run of a job in the caller's scope, newest first.
	 *
	 * The list rather than the one, because the reclaim needs to see all of them: a row that a killed
	 * worker left behind and a row a live worker is holding are the same status and different facts,
	 * and only their age tells them apart.
	 *
	 * @param jobId The job to probe.
	 * @returns The live runs, newest first.
	 */
	async findLiveRuns(jobId: string): Promise<IJobExecution[]> {
		const runs: JobExecution[] = await this.find({
			where: { jobId, status: JobExecutionStatus.RUNNING, ...this.scope },
			order: { startedAt: 'DESC' } as FindOptionsOrder<JobExecution>
		} as never);

		return runs as IJobExecution[];
	}

	/**
	 * Lists what is running right now, oldest first.
	 *
	 * The health surface's read: what is still open, and — with `startedBefore` — what has been open
	 * for longer than its job should take. Oldest first, because the row an operator has to act on is
	 * the one that has been running longest.
	 *
	 * @param filter Optional narrowing, in particular `startedBefore` for the stale read.
	 * @returns The live runs.
	 */
	async listLiveRuns(filter: IJobExecutionFindInput = {}): Promise<IJobExecution[]> {
		const runs: JobExecution[] = await this.find({
			where: {
				...this.scope,
				...this.buildWhere({ ...filter, status: JobExecutionStatus.RUNNING })
			},
			order: { startedAt: 'ASC' } as FindOptionsOrder<JobExecution>,
			take: this.normalizePageSize(filter?.limit)
		} as never);

		return runs as IJobExecution[];
	}

	/**
	 * The last run of a job, whatever its status.
	 *
	 * The operator surface's "when did this last run, and how did it end" — read by the job listing
	 * that adds a last outcome to every registered job, which is why it answers null rather than
	 * refusing when the job has never run.
	 *
	 * @param jobId The job.
	 * @returns The newest run of that job, or null when it has never run.
	 */
	async findLatestRun(jobId: string): Promise<IJobExecution | null> {
		const runs: JobExecution[] = await this.find({
			where: { jobId: this.requireJobId(jobId), ...this.scope },
			order: { startedAt: 'DESC' } as FindOptionsOrder<JobExecution>,
			take: 1
		} as never);

		return runs.length ? (runs[0] as IJobExecution) : null;
	}

	/**
	 * A job's recent runs, newest first.
	 *
	 * The ledger's primary read: one job's history, bounded so a listing cannot be asked for a year of
	 * a five-second pass in a single call.
	 *
	 * @param jobId The job.
	 * @param limit How many runs to answer with.
	 * @returns The runs, newest first.
	 */
	async listRecentRuns(jobId: string, limit?: number): Promise<IJobExecution[]> {
		const runs: JobExecution[] = await this.find({
			where: { jobId: this.requireJobId(jobId), ...this.scope },
			order: { startedAt: 'DESC' } as FindOptionsOrder<JobExecution>,
			take: this.normalizePageSize(limit)
		} as never);

		return runs as IJobExecution[];
	}

	/**
	 * A page of the ledger, newest first.
	 *
	 * Every filter is optional and the tenancy columns are not among them: the scope is the caller's,
	 * and a caller cannot read another's rows by stating one. `total` is the count the filter selects,
	 * not the count on the page, because a listing that cannot say how much there is cannot be paged.
	 *
	 * @param filter Optional narrowing by job, status, trigger or window.
	 * @returns The page and the total the filter selects.
	 */
	async paginateRuns(filter: IJobExecutionFindInput = {}): Promise<IPagination<IJobExecution>> {
		const where = { ...this.scope, ...this.buildWhere(filter) } as FindOptionsWhere<JobExecution>;
		const take = this.normalizePageSize(filter?.limit);
		const skip = this.normalizeOffset(filter?.offset);

		const items: JobExecution[] = await this.find({
			where,
			order: { startedAt: 'DESC' } as FindOptionsOrder<JobExecution>,
			take,
			skip
		} as never);
		const total = await this.count({ where } as never);

		return { items: items as IJobExecution[], total };
	}

	/**
	 * How many runs a job has, optionally narrowed.
	 *
	 * The count behind "has this pass been succeeding", asked over one job rather than the whole
	 * ledger so it is served by `IDX_job_execution_job`.
	 *
	 * @param jobId The job.
	 * @param filter Optional narrowing by status, trigger or window.
	 * @returns The number of runs the filter selects.
	 */
	async countRuns(jobId: string, filter: IJobExecutionFindInput = {}): Promise<number> {
		return this.count({
			where: { ...this.scope, ...this.buildWhere({ ...filter, jobId: this.requireJobId(jobId) }) }
		} as never);
	}

	/**
	 * Deletes the runs that have outlived the retention window.
	 *
	 * This is the ledger's **only** hard delete, and it is deliberately narrow in two ways. It deletes
	 * rows that are **over** — a live row is never purged by age, because the row is the only evidence
	 * that a run was interrupted and deleting it would erase exactly what an operator needs to see.
	 * And it deletes by batches, oldest first, so a first pass on a ledger nobody has pruned cannot
	 * hold a lock for the whole table.
	 *
	 * A ledger row is a measurement past its window; that is the whole justification for treating it
	 * differently from a dead letter, which is never deleted automatically at all.
	 *
	 * @param retentionDays How many days of history to keep. Must be a positive number.
	 * @param batchSize The most rows one call removes.
	 * @returns How many rows were removed.
	 * @throws BadRequestException `JOB_EXECUTION_STATE_INVALID` when the window is not a positive
	 * number of days, because a zero or negative window would delete the run that is executing it.
	 */
	async purgeExpiredRuns(retentionDays: number, batchSize = 5_000): Promise<number> {
		if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_EXECUTION_STATE_INVALID}: a retention window is a positive number of days, and '${String(retentionDays)}' is not one.`
			);
		}

		const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1_000);
		const expired: JobExecution[] = await this.find({
			where: {
				startedAt: Between(JobExecutionService.EPOCH, cutoff),
				// Every status a run can end in, and `RUNNING` deliberately absent: a live row is not
				// history, it is an unfinished fact.
				status: In(JobExecutionService.TERMINAL_STATUSES)
			},
			order: { startedAt: 'ASC' } as FindOptionsOrder<JobExecution>,
			take: Math.max(1, Math.floor(batchSize))
		} as never);

		if (!expired.length) {
			return 0;
		}

		const removed = await this.deleteMany(expired.map((run) => run.id));

		return removed?.affected ?? 0;
	}

	/**
	 * Builds the `where` a read narrows by, from a caller's filter.
	 *
	 * A window is expressed with `Between` and `MoreThanOrEqual` rather than with `LessThan`, and that
	 * is not a style choice: the platform's TypeORM-to-MikroORM filter conversion understands a defined
	 * set of operators, and `lessThan` is not one of them — it degrades to *no filter* with a warning,
	 * which would turn "what failed in the last hour" into "everything that ever failed" on an
	 * installation running the other mapper. Every operator used here is one both mappers honour.
	 *
	 * @param filter The caller's narrowing.
	 * @returns The conditions to merge into a read.
	 */
	private buildWhere(filter: IJobExecutionFindInput = {}): FindOptionsWhere<JobExecution> {
		const where: FindOptionsWhere<JobExecution> = {};

		if (filter.jobId) {
			where.jobId = filter.jobId;
		}

		if (filter.jobName) {
			where.jobName = filter.jobName;
		}

		if (filter.status) {
			where.status = filter.status;
		}

		if (filter.trigger) {
			where.trigger = filter.trigger;
		}

		const after = this.toInstant(filter.startedAfter);
		const before = this.toInstant(filter.startedBefore);

		if (after && before) {
			where.startedAt = Between(after, before);
		} else if (after) {
			where.startedAt = MoreThanOrEqual(after);
		} else if (before) {
			where.startedAt = Between(JobExecutionService.EPOCH, before);
		}

		return where;
	}

	/**
	 * The staleness window a call actually applies: the caller's, or the documented default.
	 *
	 * @param staleAfterMs The stated window.
	 * @returns The window in milliseconds.
	 */
	private effectiveWindow(staleAfterMs?: number): number {
		return Number.isFinite(staleAfterMs) && (staleAfterMs as number) > 0
			? (staleAfterMs as number)
			: JobExecutionService.STALE_RUN_TTL_MS;
	}

	/**
	 * Whether a live row is old enough to be an interrupted run rather than a running one.
	 *
	 * @param run The live row.
	 * @param now The instant the new attempt is being opened at.
	 * @param window The staleness window, in milliseconds.
	 * @returns True when the row has outlived the window.
	 */
	private isStale(run: IJobExecution, now: Date, window: number): boolean {
		const startedAt = this.toInstant(run.startedAt);

		if (!startedAt) {
			return false;
		}

		return now.getTime() - startedAt.getTime() > window;
	}

	/**
	 * Closes a live row whose process is gone.
	 *
	 * The mapper-agnostic closing write, made directly rather than through {@link finishRun} so that
	 * a row which is already closed by a concurrent caller does not turn the new tick into a failure:
	 * the reclaim is bookkeeping, and losing the race to close an interrupted row is not an error.
	 *
	 * @param run The stale row.
	 * @param now The instant the new attempt is being opened at.
	 * @param window The staleness window that was applied, so the row says which one it exceeded.
	 */
	private async closeStaleRun(run: IJobExecution, now: Date, window: number): Promise<void> {
		const startedAt = this.toInstant(run.startedAt) ?? now;

		await this.update(run.id, {
			status: JobExecutionStatus.CANCELLED,
			finishedAt: now,
			durationMs: Math.max(0, now.getTime() - startedAt.getTime()),
			lastError: this.bound(
				`interrupted: no finish was recorded within ${window}ms, so the run is closed as cancelled before the next attempt.`
			)
		} as never);
	}

	/**
	 * The duration of a run: what the caller states, or the distance between the two instants.
	 *
	 * Never negative. A clock that moved backwards, or a caller that passed a finish before the start,
	 * would otherwise write a duration no chart can render and no reader can trust.
	 *
	 * @param run The run being closed.
	 * @param stated The duration the caller states, when it states one.
	 * @param finishedAt The instant the run ended.
	 * @returns The duration in milliseconds.
	 */
	private resolveDuration(run: IJobExecution, stated: number | undefined, finishedAt: Date): number {
		if (typeof stated === 'number' && Number.isFinite(stated) && stated >= 0) {
			return Math.floor(stated);
		}

		const startedAt = this.toInstant(run.startedAt);

		return startedAt ? Math.max(0, finishedAt.getTime() - startedAt.getTime()) : 0;
	}

	/**
	 * The job id a write is about, refusing a row that could not be inspected afterwards.
	 *
	 * @param jobId The stated id.
	 * @returns The trimmed id.
	 * @throws BadRequestException `JOB_EXECUTION_STATE_INVALID` when it is missing or blank.
	 */
	private requireJobId(jobId?: string): string {
		const normalized = this.normalizeName(jobId);

		if (!normalized) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_EXECUTION_STATE_INVALID}: a run is recorded against the job's id, and none was presented.`
			);
		}

		return normalized;
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
	 * The attempt count a write carries: 1-based, and never zero.
	 *
	 * @param value The stated count.
	 * @returns The count to store.
	 * @throws BadRequestException `JOB_EXECUTION_STATE_INVALID` when it is not a positive integer.
	 */
	private normalizeAttemptCount(value?: number): number {
		if (value === undefined || value === null) {
			return 1;
		}

		if (!Number.isInteger(value) || value < 1) {
			throw new BadRequestException(
				`${ApiErrorCode.JOB_EXECUTION_STATE_INVALID}: an attempt count is a whole number from 1, and '${String(value)}' is not one.`
			);
		}

		return value;
	}

	/**
	 * A bounded failure text.
	 *
	 * @param value The stated text.
	 * @returns The text, truncated to the column's documented budget.
	 */
	private bound(value: string): string {
		return String(value).slice(0, JobExecutionService.MAX_ERROR_LENGTH);
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
			return JobExecutionService.DEFAULT_PAGE_SIZE;
		}

		return Math.min(Math.floor(limit), JobExecutionService.MAX_PAGE_SIZE);
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
