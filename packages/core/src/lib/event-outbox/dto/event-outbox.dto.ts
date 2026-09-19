import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { EventOutboxStatus, ID } from '@gauzy/contracts';

/**
 * The queries and the two bodies the outbox resources are read and moved with.
 *
 * **Both spellings of a filter are accepted**, because the platform's two traditions meet on this
 * resource: the delivered list routes are called with the flat members (`?status=DEAD`), and
 * `06-api-specification.md` §7 names the bracketed ones for the diagnostic reads
 * (`?filter[status]=DEAD`). A route that refused one of them would be a route whose own
 * specification is not expressible against it. The bracketed members win when a caller states both,
 * because that is the spelling the specification fixes.
 *
 * **Nothing here narrows by tenant or organization.** Both are read from the credential and applied
 * by the service, so a caller cannot state a scope it is not acting in.
 */

/**
 * The filterable members of the outbox list, in the flat spelling.
 *
 * The three members are the ones `06-api-specification.md` §7 names for `GET /events/outbox`:
 * a dispatch status, an event name and the aggregate an event is about. They are the questions the
 * backlog runbook of `12-events-webhooks-and-workflows.md` §14.5 asks — how many rows are `PENDING`,
 * which partition has stopped moving, and what one aggregate's events look like.
 */
export class EventOutboxFilterDTO {
	/**
	 * Restrict to one dispatch status.
	 */
	@ApiPropertyOptional({ type: () => String, enum: EventOutboxStatus })
	@IsOptional()
	@IsEnum(EventOutboxStatus)
	readonly status?: EventOutboxStatus;

	/**
	 * Restrict to one event name, for example `order.placed`.
	 *
	 * Carried as its value rather than as a closed list: the catalogue of `12-events-webhooks-and-workflows.md`
	 * §3 declares the names and the domain packages emit them, so an enumeration here would make a new
	 * event a change to this resource.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 160 })
	@IsOptional()
	@IsString()
	@MaxLength(160)
	readonly eventName?: string;

	/**
	 * Restrict to the events of one aggregate instance.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly aggregateId?: ID;
}

/**
 * The query of `GET /events/outbox`.
 */
export class EventOutboxQueryDTO extends EventOutboxFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => EventOutboxFilterDTO })
	@IsOptional()
	@Type(() => EventOutboxFilterDTO)
	readonly filter?: EventOutboxFilterDTO;

	/**
	 * How many rows to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	/**
	 * How many rows to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}

/**
 * The query of `GET /events/outbox/:id`.
 *
 * One member, and its allow-list is closed: the only relation this resource can attach to a row is
 * the delivery records of that row — what each consumer did with the event — and a relation the
 * resource does not offer is `QUERY_EXPAND_NOT_ALLOWED` rather than a silently ignored parameter.
 */
export class EventOutboxDetailQueryDTO {
	/**
	 * The relations to attach to the row: `deliveries`.
	 */
	@ApiPropertyOptional({ type: () => [String], enum: ['deliveries'] })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) =>
		Array.isArray(value)
			? value
			: String(value ?? '')
					.split(',')
					.map((one) => one.trim())
					.filter(Boolean)
	)
	@IsArray()
	@IsEnum(['deliveries'], { each: true })
	readonly expand?: string[];
}

/**
 * The filterable members of the delivery list, in the flat spelling.
 *
 * The three members are the ones `12-events-webhooks-and-workflows.md` §5.4 and §14.9 name for the
 * dead-letter listing: a status, the consumer key the delivery belongs to, and the event it is
 * about.
 */
export class EventDeliveryFilterDTO {
	/**
	 * Restrict to one delivery status.
	 */
	@ApiPropertyOptional({ type: () => String, enum: EventOutboxStatus })
	@IsOptional()
	@IsEnum(EventOutboxStatus)
	readonly status?: EventOutboxStatus;

	/**
	 * Restrict to one consumer, by its namespaced key — `subscriber:<key>`, `job:<queue>` or
	 * `webhook:<subscriptionId>`. This is the member the dead-letter runbook groups by.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 191 })
	@IsOptional()
	@IsString()
	@MaxLength(191)
	readonly consumerKey?: string;

	/**
	 * Restrict to the delivery records of one event.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly eventId?: ID;
}

/**
 * The query of `GET /events/deliveries`.
 */
export class EventDeliveryQueryDTO extends EventDeliveryFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => EventDeliveryFilterDTO })
	@IsOptional()
	@Type(() => EventDeliveryFilterDTO)
	readonly filter?: EventDeliveryFilterDTO;

	/**
	 * How many rows to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	/**
	 * How many rows to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}

/**
 * What a caller states when it dead-letters one delivery.
 *
 * **The reason is required, and that is the point of the body.** Dead-lettering is a deliberate
 * decision to stop re-driving a real fact, so the record has to say who decided and why: the reason
 * is written onto the row's `lastError`, which is the column an operator reads afterwards — a move
 * that left that column empty would destroy the diagnosis that made the move necessary. The
 * automated path needs no body at all, because there the reason *is* the consumer's exception.
 */
export class MarkEventDeliveryDeadDTO {
	/**
	 * Why this delivery is being stopped, in the operator's own words.
	 */
	@ApiProperty({ type: () => String, maxLength: 2000 })
	@IsString()
	@IsNotEmpty()
	@MaxLength(2000)
	readonly reason: string;
}
