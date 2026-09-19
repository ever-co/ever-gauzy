import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ID, WebhookDeliveryStatus } from '@gauzy/contracts';

/**
 * The narrowing members of the delivery log.
 *
 * The four the endpoint table names, and they are the four a work list is taken by: the endpoint that
 * is behind, one event id a partner has quoted, one event name, and a status group. The stored body is
 * not among them — it is not a column this resource answers with at all — and neither is the response
 * body, which is triage text rather than something a list is selected by.
 */
export class WebhookDeliveryFilterDTO {
	/**
	 * Restrict to the deliveries of one subscription.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly subscriptionId?: ID;

	/**
	 * Restrict to the delivery of one event.
	 *
	 * An event id arrives already encoded in a query string, so a delivery row that no longer exists —
	 * deliveries outlive outbox retention — is still a member of this filter's value set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly eventId?: ID;

	/**
	 * Restrict to one event name.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 160 })
	@IsOptional()
	@IsString()
	@MaxLength(160)
	readonly eventName?: string;

	/**
	 * Restrict to one status group.
	 *
	 * A query string carries text and the column holds the vocabulary's own value, so the value is
	 * read as the enumeration rather than as free text: `?status=DEAD` is a question about the
	 * terminal group, and a value outside the vocabulary is a validation failure rather than a filter
	 * that quietly selects nothing.
	 */
	@ApiPropertyOptional({ type: () => String, enum: WebhookDeliveryStatus })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) =>
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as { eq?: unknown }).eq
			: value
	)
	@IsEnum(WebhookDeliveryStatus)
	readonly status?: WebhookDeliveryStatus;
}

/**
 * The query of `GET /webhooks/deliveries`.
 *
 * Both spellings of the same filter are accepted, as they are on the subscription list: the flat one
 * the platform's list routes are called with, and the bracketed one the endpoint table names. The
 * bracketed members win when both are stated, because that is the spelling the specification fixes.
 *
 * The page is the platform's own `take`/`skip`, so the same page size and the same cap apply here as
 * on every other list route — and a page above the cap is refused rather than answered whole.
 */
export class WebhookDeliveryQueryDTO extends WebhookDeliveryFilterDTO {
	/**
	 * The bracketed spelling of the same four members.
	 */
	@ApiPropertyOptional({ type: () => WebhookDeliveryFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => WebhookDeliveryFilterDTO)
	readonly filter?: WebhookDeliveryFilterDTO;

	/**
	 * How many deliveries to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	/**
	 * How many deliveries to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}
