import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { DeadLetterStatus, ID, IJobDeadLetter, IUser, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne
} from '../core/decorators/entity';
import { MikroOrmJobDeadLetterRepository } from './repository/mikro-orm-job-dead-letter.repository';

/**
 * One job that exhausted its attempts — the platform's only dead-letter form.
 *
 * **Why there is no per-queue dead-letter queue beside it.** A queue's own failed set is the queue's
 * bookkeeping: it expires on the queue's `removeOnFail` policy, it is readable only through that
 * queue's connection, and when it expires the failure is simply gone. A job that exhausts its attempts
 * is a platform-level fact whatever queue it came from, and it has to stay inspectable and replayable
 * by an operator after the queue has forgotten it. So there is one store, it is a table, and it is
 * named for what it holds rather than for the queue that produced it.
 *
 * **The payload is stored verbatim**, which is the whole point of the row: a replay re-enqueues exactly
 * what failed, so a defect that has since been fixed can be retried against the same input instead of
 * being reconstructed by hand from a log line. That is also why the row is never deleted
 * automatically — discarding is a status change an operator makes with a reason, and the discarded
 * rows are the record of what was decided not to retry.
 *
 * **`jobId` keeps the id of the job that failed.** It is the second half of `UQ_job_dead_letter_job`,
 * the tuple that makes one failure one row, and rewriting it during a replay would make the replayed
 * row collide with the dead letter of its own retry — the one row an operator needs next. The id the
 * replay enqueued is recorded in `metadata.replayedJobId`, so the schema's "a replay writes `REPLAYED`
 * and the new job id" is satisfied by the columns §3.22 actually declares.
 */
@ColumnIndex('UQ_job_dead_letter_job', ['queueName', 'jobId'], {
	unique: true,
	where: '"jobId" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_job_dead_letter_status', ['status', 'failedAt'], { where: '"deletedAt" IS NULL' })
@MultiORMEntity('job_dead_letter', { mikroOrmRepository: () => MikroOrmJobDeadLetterRepository })
export class JobDeadLetter extends TenantOrganizationBaseEntity implements IJobDeadLetter {
	/**
	 * The queue the job belonged to.
	 *
	 * It is the operator's grouping — the queue listing, the per-queue depth an operator watches — and
	 * the first half of the row's business key. It is a stored name rather than a foreign key because
	 * the queue registry lives in the queue's own process, not in this database, and a row has to stay
	 * addressable for a queue that is not currently declared: replaying into a queue that no longer
	 * exists is refused by name, which is an answer an operator can act on.
	 */
	@ApiProperty({ type: () => String, maxLength: 128 })
	@IsString()
	@MinLength(1)
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128 })
	queueName: string;

	/**
	 * The job's identifier on its queue, when the queue issued one.
	 *
	 * Null is a real case and not a defect: a job can fail before it is ever given an id, and a staging
	 * or inline execution has no queue id at all. `NULL` values are distinct in a unique index on every
	 * dialect, so several such rows coexist without colliding on the rule that makes one failing job one
	 * row.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128, nullable: true })
	jobId?: string;

	/**
	 * The job's name: what an operator recognises in a listing, and the other half of the read that
	 * groups failures by the kind of work that broke.
	 */
	@ApiProperty({ type: () => String, maxLength: 128 })
	@IsString()
	@MinLength(1)
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128 })
	jobName: string;

	/**
	 * The job's data, exactly as it was enqueued.
	 *
	 * Stored verbatim and never edited: a replay hands this value back to the queue, so anything the
	 * platform did to it between the failure and the replay would make the retry a different job. Read
	 * whole; nothing filters on a key of it.
	 */
	@ApiProperty({ type: () => Object })
	@JsonColumn<JsonData>({})
	payload: JsonData;

	/**
	 * Where the row stands in an operator's hands: `NEW` until somebody acts, `REPLAYED` or
	 * `DISCARDED` afterwards, and terminal either way.
	 */
	@ApiProperty({ type: () => String, enum: DeadLetterStatus, default: DeadLetterStatus.NEW })
	@IsEnum(DeadLetterStatus)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: DeadLetterStatus,
		default: DeadLetterStatus.NEW
	})
	status: DeadLetterStatus;

	/**
	 * How many attempts the job made before its attempts were exhausted.
	 *
	 * It is what distinguishes a job that failed once and gave up from one that failed five times and
	 * kept failing, and it is the number the queue's own policy is checked against when a replay is
	 * decided.
	 */
	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int' })
	attemptCount: number;

	/**
	 * When the last attempt failed: the instant the row entered the operator's queue, and the ordering
	 * column of `IDX_job_dead_letter_status`.
	 */
	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ default: () => 'CURRENT_TIMESTAMP' })
	failedAt: Date;

	/**
	 * Why the last attempt failed. Bounded, because a stack trace is evidence and not a document.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string;

	/**
	 * When an operator replayed it. Non-null exactly when `status` is `REPLAYED`.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	replayedAt?: Date;

	/**
	 * Who replayed it.
	 *
	 * The reference releases rather than cascades — the row is the record that a job failed and that
	 * somebody acted on it, and removing the actor's account must not erase the fact, which is the
	 * schema's bucket-4 policy for an optional reference to a master row applied to a person.
	 *
	 * The property is named `replayedByUser`, not `replayedBy`, because the mapped column is derived
	 * from it: the platform's own `createdByUser`/`createdByUserId` pair is the convention that makes
	 * the join column land on the `replayedByUserId` column §3.22 declares.
	 */
	@ApiPropertyOptional({ type: () => User })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	replayedByUser?: IUser;

	/** The user `replayedByUser` names. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: JobDeadLetter) => it.replayedByUser)
	@MultiORMColumn({ nullable: true, relationId: true })
	replayedByUserId?: ID;

	/**
	 * When an operator discarded it. Non-null exactly when `status` is `DISCARDED`.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	discardedAt?: Date;

	/**
	 * Why an operator discarded it.
	 *
	 * Required by the service on every discard, because a discard is the one action that ends a
	 * failure's life without fixing it, and "we decided not to retry this" is only defensible when it
	 * says why.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	discardedReason?: string;

	/**
	 * The queue's own failure detail — the stack trace, the queue's attempt verdict, the id the replay
	 * enqueued (`metadata.replayedJobId`).
	 *
	 * Read whole. `payload` is what a replay re-enqueues; this is what a human reads, and the two are
	 * deliberately separate so that enriching the operator's view can never change what is retried.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
