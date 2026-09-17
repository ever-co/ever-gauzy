import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { RelationId } from 'typeorm';
import { ID, IOperationStep, JsonData, OperationStepStatus } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { Operation } from './operation.entity';
import { MikroOrmOperationStepRepository } from './repository/mikro-orm-operation-step.repository';

/**
 * One step of an operation, and the reason a restart resumes rather than restarts.
 *
 * `(operationId, name)` is unique, so a retried step cannot be duplicated; `compensationData` is
 * written when the step succeeds, so its compensator never has to re-derive the reservation id, the
 * provider reference or the quantity to release. A step found in a terminal status is never invoked
 * again.
 */
@MultiORMEntity('operation_step', { mikroOrmRepository: () => MikroOrmOperationStepRepository })
export class OperationStep extends TenantOrganizationBaseEntity implements IOperationStep {
	/**
	 * The operation this step belongs to.
	 */
	@ApiProperty({ type: () => Operation })
	@MultiORMManyToOne(() => Operation, (operation) => operation.steps, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	operation?: Operation;

	/**
	 * Id of the owning operation. Composite indexes over this column serve the referential check.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: OperationStep) => it.operation)
	@MultiORMColumn({ nullable: false, relationId: true })
	operationId: ID;

	/**
	 * Stable step name, unique per operation, for example `reserve-stock`.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	name: string;

	/**
	 * Execution order; the compensating walk uses the reverse of it.
	 */
	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int' })
	order: number;

	/**
	 * Where this step stands.
	 */
	@ApiProperty({ type: () => String, enum: OperationStepStatus })
	@IsEnum(OperationStepStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', default: OperationStepStatus.PENDING })
	status: OperationStepStatus;

	/**
	 * The step's resolved input: a projection of the operation's input plus the outputs of the steps
	 * before it. Persisted so the operation can be reconstructed exactly as it ran.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	input?: JsonData;

	/**
	 * What the step produced, merged into the operation's state for later steps.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	output?: JsonData;

	/**
	 * Exactly what the compensator needs: the created ids, the previous values, the external
	 * reference. Written when the step succeeds and handed back untouched during compensation.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	compensationData?: JsonData;

	/**
	 * Attempts made, including the ones that failed.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	attemptCount: number;

	/**
	 * Last error, as an `IOperationError`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string;

	/**
	 * When the current attempt started.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	startedAt?: Date;

	/**
	 * When the step reached a terminal status.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	finishedAt?: Date;
}
