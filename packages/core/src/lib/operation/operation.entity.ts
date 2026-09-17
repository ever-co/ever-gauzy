import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { RelationId } from 'typeorm';
import { ID, IOperation, IOperationState, OperationStatus, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { OperationStep } from './operation-step.entity';
import { MikroOrmOperationRepository } from './repository/mikro-orm-operation.repository';

/**
 * The saga header.
 *
 * Checkout completion, capture, fulfilment creation, return receipt and subscription billing are
 * long, multi-step, cross-aggregate operations that change several aggregates across several
 * external calls. A single database transaction cannot span them and a fire-and-forget sequence
 * cannot be recovered after a crash, so the plan, the progress and the undo information are
 * persisted here: any of these operations is then resumable, observable, cancellable and reversible.
 *
 * Two uniqueness rules carry the runtime's guarantees. `UQ_operation_aggregate_live` makes two
 * concurrent operations on one aggregate impossible, and `UQ_operation_idem` makes a retried request
 * return the original operation instead of starting a second one.
 */
@MultiORMEntity('operation', { mikroOrmRepository: () => MikroOrmOperationRepository })
export class Operation extends TenantOrganizationBaseEntity implements IOperation {
	/**
	 * Operation type, for example `CHECKOUT_COMPLETE`.
	 *
	 * A definition must be registered for the type before an operation of it can be started, so a
	 * worker refuses to half-execute an operation whose steps it does not know.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	type: string;

	/**
	 * Where the operation stands.
	 */
	@ApiProperty({ type: () => String, enum: OperationStatus })
	@IsEnum(OperationStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', default: OperationStatus.PENDING })
	status: OperationStatus;

	/**
	 * The request that started the operation. Never mutated after creation.
	 */
	@ApiProperty({ type: () => Object })
	@JsonColumn<JsonData>({ defaultValue: {} })
	input: JsonData;

	/**
	 * The mutable execution state: cursor, lease, cancellation flag and shared variables.
	 *
	 * Read whole and written whole, which is why it is JSON rather than a column per field: the
	 * runtime is the only writer and it always replaces the object it read.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<IOperationState>({ nullable: true })
	state?: IOperationState;

	/**
	 * The terminal outcome, written on `COMPLETED`, `COMPENSATED` or `CANCELED`.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	result?: JsonData;

	/**
	 * Operation-level attempts.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	attemptCount: number;

	/**
	 * Operation-level attempt budget: a step that exhausts its own attempts consumes one of these.
	 */
	@ApiProperty({ type: () => Number, default: 3 })
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 3 })
	maxAttempts: number;

	/**
	 * The last error, as an `IOperationError`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string;

	/**
	 * Links the operation to the key that started it.
	 *
	 * Unique per organization and type when set, which is what makes a retried submission return the
	 * original operation rather than starting a second one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	idempotencyKey?: string;

	/**
	 * The operation that started this one, when a step of another operation did.
	 */
	@ApiPropertyOptional({ type: () => Operation })
	@IsOptional()
	@MultiORMManyToOne(() => Operation, (operation) => operation.childOperations, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	parentOperation?: IOperation;

	/**
	 * Id of the parent operation.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Operation) => it.parentOperation)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	parentOperationId?: ID;

	/**
	 * Operations started from this one.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@MultiORMOneToMany(() => Operation, (operation) => operation.parentOperation)
	childOperations?: Operation[];

	/**
	 * The steps of this operation, executed in ascending `order`.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@MultiORMOneToMany(() => OperationStep, (step) => step.operation, {
		onDelete: 'CASCADE'
	})
	steps?: OperationStep[];

	/**
	 * When the first step started.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	startedAt?: Date;

	/**
	 * When the operation reached a terminal status.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	finishedAt?: Date;

	/**
	 * Wall-clock limit for the whole operation.
	 *
	 * Past it the runtime starts no further step and compensates instead, so an operation cannot sit
	 * on an aggregate forever. A step already running is bounded by its own timeout, not killed.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	deadlineAt?: Date;

	/**
	 * The aggregate the operation owns: `order`, `commerce_cart`, `return`, `claim`, `exchange`,
	 * `purchase_order`, `stock_transfer`, `subscription`.
	 *
	 * Together with `aggregateId` it is what the exclusivity rule is expressed over.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	aggregateType?: string;

	/**
	 * Id of that aggregate.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	aggregateId?: ID;

	/**
	 * Ties every event and log line produced by the operation together.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	correlationId?: ID;
}
