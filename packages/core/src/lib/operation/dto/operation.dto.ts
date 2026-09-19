import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ID, OperationStatus } from '@gauzy/contracts';

/**
 * The filterable members of the operation list, in the flat spelling.
 *
 * The members are the columns an operator looks an operation up by, and nothing else. The lease
 * (`lockedBy`, `leaseExpiresAt`) is deliberately absent: the stuck-operation read is a question about
 * *when* a lease lapsed rather than about which worker holds it, and `lockedBy` is an internal worker
 * identity rather than something a caller addresses an operation by.
 */
export class OperationFilterDTO {
	/**
	 * Restrict to one operation type, for example `CHECKOUT_COMPLETE`.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly type?: string;

	/**
	 * Restrict to one status — the operation queue's own question, for example `PENDING` for the work
	 * still waiting to run.
	 */
	@ApiPropertyOptional({ type: () => String, enum: OperationStatus })
	@IsOptional()
	@IsEnum(OperationStatus)
	readonly status?: OperationStatus;

	/**
	 * Restrict to the operations of one kind of aggregate, for example `order`.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly aggregateType?: string;

	/**
	 * Restrict to the operations of one aggregate instance.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly aggregateId?: ID;

	/**
	 * Restrict to the operations started from one other operation, whose step started them.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly parentOperationId?: ID;

	/**
	 * Restrict to the operations tied together by one correlation id, which is how every log line and
	 * every event of one run is found again.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly correlationId?: ID;

	/**
	 * Restrict to the operation one caller's key started.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly idempotencyKey?: string;
}

/**
 * The query of `GET /operations`.
 *
 * Both spellings of the same filter are accepted: the flat one this platform's delivered list routes
 * are called with, and the bracketed one (`?filter[status]=COMPENSATING`) the endpoint table names for
 * the resource. The bracketed members win when both are stated, because that is the spelling the
 * specification fixes.
 *
 * `take` and `skip` are the page, and they are applied to the rows the read returned rather than
 * pushed into the store — which is the same page the GraphQL connection's `limit` and `offset` are,
 * so a cursor obtained over one surface resumes on the other.
 */
export class OperationQueryDTO extends OperationFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => OperationFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => OperationFilterDTO)
	readonly filter?: OperationFilterDTO;

	/**
	 * How many operations to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	/**
	 * How many operations to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}

/**
 * What a caller states when it cancels an operation.
 *
 * The reason is recorded on the operation — it is what `lastError` and the terminal `result` carry —
 * and it is optional, because a cancellation is a legitimate operator action that does not have to be
 * justified to be performed. Nothing else is accepted: a cancellation is a request the runtime
 * observes at its next checkpoint rather than a kill, and there is no member that would make it one.
 */
export class CancelOperationDTO {
	/**
	 * Why the operation is being cancelled, as the operator states it.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@MaxLength(255)
	readonly reason?: string;
}
