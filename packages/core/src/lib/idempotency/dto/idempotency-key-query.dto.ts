import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { IdempotencyStatus } from '@gauzy/contracts';

/**
 * The narrowing an operator's key list accepts.
 *
 * Four columns and no more, each of them a whole value rather than a fragment. A stored key is not a
 * document anybody browses: it is a row an operator arrives at already knowing which operation and
 * which key it is about, because that is what the client that is stuck can tell them. Offering a
 * pattern match over `requestHash`, or a date range over the whole table, would invite exactly the
 * scan the unique index on `(organizationId, scope, key)` exists to avoid — and would answer a
 * question nobody asked.
 *
 * The tenant and the organization are absent on purpose: both are read from the credential by the
 * service, so a caller states what it is looking for and never whose keys it is looking at.
 *
 * The page is stated as a plain `take` and `skip` pair rather than through the shared query DTO,
 * because this resource is read by an operator chasing one stuck client and not by an application
 * walking a collection: the GraphQL connection offers `page`, `limit` and `offset` over the same rows
 * for a caller that wants to walk them.
 */
export class IdempotencyKeyQueryDTO {
	/**
	 * The operation namespace, for example `checkout.complete`.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'The operation namespace the key belongs to.' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly scope?: string;

	/**
	 * The client-supplied key.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'The key the client presented.' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly key?: string;

	/**
	 * The lifecycle the row reached.
	 */
	@ApiPropertyOptional({ enum: IdempotencyStatus, description: 'The lifecycle the stored key reached.' })
	@IsOptional()
	@IsEnum(IdempotencyStatus)
	readonly status?: IdempotencyStatus;

	/**
	 * What the operation was recorded as creating.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'What the operation was recorded as creating.' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly resourceType?: string;

	/**
	 * How many rows to answer.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, description: 'How many keys to answer.' })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	readonly take?: number;

	/**
	 * How many rows to pass over.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0, description: 'How many keys to pass over.' })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}
