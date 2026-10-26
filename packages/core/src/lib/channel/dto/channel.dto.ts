import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested
} from 'class-validator';
import { ChannelStatus, CurrencyCode, ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { parseToBoolean } from '@gauzy/utils';

/**
 * What a caller states when it opens a sales context.
 *
 * The lifecycle members are absent, and their absence is the contract: the channel is created
 * `DRAFT` by the service and reaches `ACTIVE` through the status write, its default flag is claimed
 * through the set-default write, and its default region is named by the write that publishes it. A
 * body that stated one of them would be stating something the resource has a route for.
 *
 * `defaultCurrency` is validated as an exact three-letter code rather than as an enumeration: the
 * currency master is a table, so a closed list in a DTO would refuse a currency the master carries
 * the moment the master is extended. The service checks the value it stores.
 */
export class CreateChannelDTO extends TenantOrganizationBaseDTO {
	/**
	 * Admin-facing name.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	readonly name: string;

	/**
	 * Stable key, unique per organization among the live rows. Written once.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	readonly code: string;

	/**
	 * Free-text description shown in the administration surface.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;

	/**
	 * The currency a cart created without one is priced in. An exact three-letter ISO code.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 3, minLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly defaultCurrency?: CurrencyCode;

	/**
	 * BCP-47 locale for translated content.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 10 })
	@IsOptional()
	@IsString()
	@MaxLength(10)
	readonly defaultLocale?: string;

	/**
	 * Prefix handed to the numbering series this channel numbers its documents with.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 16 })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	readonly orderNumberPrefix?: string;

	/**
	 * Zero-padding width of the numeric part of an order number.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, default: 6 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	readonly orderNumberPadding?: number;

	/**
	 * Channel-scoped overrides read by the checkout, tax and fulfilment strategies, as a document.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly settings?: JsonData;

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * What a caller may change on a channel that exists.
 *
 * `code` is deliberately absent. A body that carried it is refused by the service rather than
 * silently ignored, because the code is the channel's identity in every URL, seed and import that
 * names it. `status` and `isDefault` are absent for the same reason: each has an operation of its
 * own.
 */
export class UpdateChannelDTO extends TenantOrganizationBaseDTO {
	/**
	 * Admin-facing name.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	readonly name?: string;

	/**
	 * Free-text description.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;

	/**
	 * The currency a cart created without one is priced in.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 3, minLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly defaultCurrency?: CurrencyCode;

	/**
	 * BCP-47 locale for translated content.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 10 })
	@IsOptional()
	@IsString()
	@MaxLength(10)
	readonly defaultLocale?: string;

	/**
	 * Prefix handed to the numbering series.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 16 })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	readonly orderNumberPrefix?: string;

	/**
	 * Zero-padding width of the numeric part of an order number.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	readonly orderNumberPadding?: number;

	/**
	 * Channel-scoped overrides, replaced whole.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly settings?: JsonData;

	/**
	 * Tenant extras, replaced whole.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * The lifecycle move a caller asks for.
 *
 * The status is required and validated as the platform's own enumeration, so an unknown status is a
 * validation failure rather than a write the service has to refuse a second time.
 */
export class SetChannelStatusDTO {
	/**
	 * The status the channel moves to.
	 */
	@ApiProperty({ type: () => String, enum: ChannelStatus })
	@IsEnum(ChannelStatus)
	readonly status: ChannelStatus;
}

/**
 * One member of a channel's region set, as the whole-set replacement states it.
 */
export class ChannelRegionMemberDTO {
	/**
	 * The region to publish to the channel.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly regionId: ID;

	/**
	 * Whether this region is the channel's fallback region. At most one member may carry it.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isDefault?: boolean;
}

/**
 * The region set a channel sells into afterwards.
 *
 * The replacement is a **set** rather than a member-per-call operation, so the body carries every
 * member the channel is left with: the regions it states are published and the ones it leaves out
 * are withdrawn in one transaction. An empty list is legitimate — a channel that sells nowhere is a
 * channel being configured — which is why the list carries no minimum length.
 */
export class ReplaceChannelRegionsDTO {
	/**
	 * The regions the channel sells into afterwards.
	 */
	@ApiProperty({ type: () => [ChannelRegionMemberDTO] })
	@IsArray()
	@ArrayMinSize(0)
	@ValidateNested({ each: true })
	@Type(() => ChannelRegionMemberDTO)
	readonly items: ChannelRegionMemberDTO[];
}

/**
 * The filterable members of the channel list, in the flat spelling.
 */
export class ChannelFilterDTO {
	/**
	 * Restrict to one lifecycle status.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ChannelStatus })
	@IsOptional()
	@IsEnum(ChannelStatus)
	readonly status?: ChannelStatus;

	/**
	 * Restrict to the channel under one code.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code?: string;

	/**
	 * Restrict to the organization's default channel, or to the ones that are not.
	 *
	 * A query string carries text, so the value is read with the platform's own boolean reader:
	 * `?isDefault=false` is a question about the channels that are **not** the default, and a plain
	 * cast would read the word "false" as true and answer the opposite question.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly isDefault?: boolean;
}

/**
 * The query of `GET /channels`.
 *
 * Both spellings of the same filter are accepted: the flat one this platform's delivered list routes
 * are called with, and the bracketed one (`?filter[status]=ACTIVE`) the endpoint table names for the
 * resource. The bracketed members win when both are stated, because that is the spelling the
 * specification fixes.
 */
export class ChannelQueryDTO extends ChannelFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => ChannelFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => ChannelFilterDTO)
	readonly filter?: ChannelFilterDTO;

	/**
	 * How many channels to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	/**
	 * How many channels to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;

	/**
	 * The relations to attach to each row, as the endpoint table's `expand` parameter.
	 *
	 * Validated against a closed list rather than accepted as free text: a relation this resource
	 * does not offer is `QUERY_EXPAND_NOT_ALLOWED`, which is the refusal the query protocol names for
	 * an expansion outside the resource's allow-list.
	 */
	@ApiPropertyOptional({ type: () => [String], enum: ['domains', 'regions'] })
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
	@IsEnum(['domains', 'regions'], { each: true })
	readonly expand?: string[];

	/**
	 * Whether retired channels are included, which is what the GraphQL connection's `withDeleted` states.
	 *
	 * The two surfaces must offer the same visibility: a client that can ask the connection for a
	 * soft-deleted channel and cannot ask this route for it has two answers to one question. Stated the
	 * same way `isDefault` is, because a query string carries text — `?withDeleted=false` must not read as
	 * the word "false" being truthy.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly withDeleted?: boolean;
}

/**
 * The query of `GET /channels/:id`.
 *
 * A detail read states one thing and nothing else on this resource: which relations to attach. Its
 * expansion allow-list is closed for the same reason the list's is — a relation the resource does
 * not offer is refused rather than silently ignored.
 */
export class ChannelDetailQueryDTO {
	/**
	 * The relations to attach to the channel: `domains` and `regions`.
	 */
	@ApiPropertyOptional({ type: () => [String], enum: ['domains', 'regions'] })
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
	@IsEnum(['domains', 'regions'], { each: true })
	readonly expand?: string[];
}

/**
 * The query of `DELETE /channels/:id`.
 *
 * `force` is the member the endpoint table names. It is accepted, validated, and does not change
 * what the route does — see the controller for why the removal this resource offers is a retirement
 * whatever the flag says.
 */
export class DeleteChannelQueryDTO {
	/**
	 * Whether the caller asks for the strongest removal the resource offers.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly force?: boolean;
}
