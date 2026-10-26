import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { IJobExecution, JobExecutionStatus, JobTrigger, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmJobExecutionRepository } from './repository/mikro-orm-job-execution.repository';

/**
 * One attempt of one scheduled job — the platform's single run ledger.
 *
 * **Why the platform needs it.** The scheduler could run a pass but not remember one. A pass that
 * failed left a single `logger.error` line, which rotates away; a pass that never started because
 * another instance held it left nothing at all; and "did the reconciliation run last night, and what
 * did it do" was answerable only by grepping logs that may already be gone. This row is the answer for
 * every scheduled pass in the tree — the measurement audit, the payment-instrument audit, the expiry
 * sweeps, the reconciliation passes, the payout run, and every pass a plugin declares — because they
 * are all registered through the same scheduler, so one ledger answers for all of them instead of one
 * table per job family.
 *
 * **Why it is a kernel table and not a plugin's.** The scheduler is a platform package, not a plugin:
 * a capability cannot own the record of a pass another capability runs. Naming it for the concept —
 * a job's execution — rather than for a domain is what lets a payroll pass, a document pass and an
 * inventory pass be recorded identically.
 *
 * **The row is a fact and is not rewritten.** One row per attempt, one terminal status per row, and
 * the attempt count says which attempt it was, so a retried pass is legible as a retry rather than as
 * one row that changed its mind. `finishedAt` is non-null exactly when `status` is not `RUNNING`, and
 * a tick that could not start is a `SKIPPED_OVERLAP` row rather than silence — "the job did not run"
 * and "the job ran and did nothing" are different facts, and an operator who cannot tell them apart
 * cannot tell a slow job from a stopped one. All of that is enforced by `JobExecutionService`; the two
 * indexes below are the reads those rules are asked through.
 */
@ColumnIndex('IDX_job_execution_job', ['jobId', 'startedAt'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_job_execution_state', ['status', 'startedAt'], { where: '"status" = \'RUNNING\'' })
@MultiORMEntity('job_execution', { mikroOrmRepository: () => MikroOrmJobExecutionRepository })
export class JobExecution extends TenantOrganizationBaseEntity implements IJobExecution {
	/**
	 * The registered job's id, as the scheduler's registry resolves it (`metadata.name`, or
	 * `<provider>.<method>` when the declaration names none).
	 *
	 * It is the ledger's grouping key and the first column of `IDX_job_execution_job`, which is why it
	 * is a stored string rather than a foreign key into a registry table: the registry is in memory and
	 * is rebuilt at every boot, so a constraint onto it is not expressible and a row has to stay
	 * readable after the job it names is renamed or removed.
	 */
	@ApiProperty({ type: () => String, maxLength: 128 })
	@IsString()
	@MinLength(1)
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128 })
	jobId: string;

	/**
	 * The job's name at the moment of the run.
	 *
	 * Denormalised for the same reason the id is stored rather than referenced: a ledger read a month
	 * later must not depend on today's registry. It defaults to the id when the caller knows no better
	 * name, so a row is never nameless.
	 */
	@ApiProperty({ type: () => String, maxLength: 128 })
	@IsString()
	@MinLength(1)
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128 })
	jobName: string;

	/**
	 * What caused this attempt.
	 *
	 * It decides what an operator does about a failure rather than merely labelling it: a `SCHEDULED`
	 * run that failed is a broken pass, a `MANUAL` run that failed is somebody's diagnostic, a `RETRY`
	 * row is the continuation of a failure the ledger already holds, and a `FAN_OUT` row is one
	 * partition and is read with its siblings.
	 */
	@ApiProperty({ type: () => String, enum: JobTrigger, default: JobTrigger.SCHEDULED })
	@IsEnum(JobTrigger)
	@MultiORMColumn({ type: 'simple-enum', enum: JobTrigger, default: JobTrigger.SCHEDULED })
	trigger: JobTrigger;

	/**
	 * Where the attempt stands. `RUNNING` while it is in flight; one of the four others once it is
	 * over, after which the row is never rewritten.
	 */
	@ApiProperty({
		type: () => String,
		enum: JobExecutionStatus,
		default: JobExecutionStatus.RUNNING
	})
	@IsEnum(JobExecutionStatus)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: JobExecutionStatus,
		default: JobExecutionStatus.RUNNING
	})
	status: JobExecutionStatus;

	/**
	 * Which attempt this is, 1-based.
	 *
	 * A retrying job writes one row per attempt rather than one row that counts, so the number is what
	 * ties the rows of one run together and what says how far the ladder got before it gave up.
	 */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	attemptCount: number;

	/**
	 * When the attempt started.
	 *
	 * A skip is stamped with the instant the tick was observed, even though nothing ran: the row still
	 * has to answer "when was this job due and refused", and a null start would make the ledger's
	 * newest-first read skip it.
	 */
	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ default: () => 'CURRENT_TIMESTAMP' })
	startedAt: Date;

	/**
	 * When the attempt reached its terminal status. Null exactly while `status` is `RUNNING`.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	finishedAt?: Date;

	/**
	 * How long the attempt took, in milliseconds.
	 *
	 * Stored rather than derived, because it is the measurement a duration chart is built from and
	 * because a slow pass is the leading indicator of a pass about to fail. It is derived once, from
	 * the two instants, when the caller states none.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', nullable: true })
	durationMs?: number;

	/**
	 * The instance that ran it — host and process, so a job that ran twice across replicas is
	 * diagnosable from the ledger alone. Null for a run that never started, which is what a skip is.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128, nullable: true })
	nodeId?: string;

	/**
	 * Why the attempt did not succeed: the failure for a `FAILED` run, and the reason a tick was
	 * refused for a `SKIPPED_OVERLAP` one.
	 *
	 * The second use is deliberate. §3.21 declares no reason column, and a skip whose cause lived only
	 * inside `metadata` would be a row an operator has to decode to answer the one question they have
	 * about it. The service bounds what it writes here, because a stack trace is evidence and not a
	 * document.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string;

	/**
	 * The job's own counters: rows scanned, items emitted, children enqueued.
	 *
	 * Read whole by design — nothing filters on a key of it, because a value a query branches on
	 * belongs in a column. It is what makes the ledger answer what a pass *did* and not only whether
	 * it succeeded: a reconciliation that scanned zero rows succeeded and is still the fact somebody
	 * needs to see.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
