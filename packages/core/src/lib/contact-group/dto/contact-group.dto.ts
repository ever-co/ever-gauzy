import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested
} from 'class-validator';
import { ContactGroupType, ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { parseToBoolean } from '@gauzy/utils';

/**
 * What a caller states when it creates a group.
 *
 * `isSystem` is deliberately absent, and its absence is the contract: the flag is what makes a group
 * undeletable and un-recordable, so it is written by the platform's own seeding path and never by a
 * request. A body that carried it is refused by the service rather than ignored, because a caller that
 * believes it made a group undeletable has a bug it would otherwise never see.
 *
 * `discountPercent` is a **fraction** and not a percentage — `0.1` is ten per cent — and the range is
 * validated here as well as in the service, because a caller that sent `10` meaning ten per cent must
 * be refused rather than handed a group that discounts everything by a thousand per cent.
 */
export class CreateContactGroupDTO extends TenantOrganizationBaseDTO {
	/**
	 * The display name of the group, as an operator reads it.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	readonly name: string;

	/**
	 * The stable key an integration addresses the group by. Unique per organization among live rows,
	 * compared case-insensitively, and trimmed by the service.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	readonly code: string;

	/**
	 * What the group is for, in the tenant's own words.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;

	/**
	 * Whether membership is explicit or computed. Defaults to `STATIC`.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ContactGroupType })
	@IsOptional()
	@IsEnum(ContactGroupType)
	readonly type?: ContactGroupType;

	/**
	 * The price list granted to every member of this group.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly priceListId?: ID;

	/**
	 * The group-wide discount, as a fraction between 0 and 1.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0, maximum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	@Max(1)
	readonly discountPercent?: number;

	/**
	 * Tenant-defined extras that nothing filters on.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * What a caller may change on a group that exists.
 *
 * The kind is among the mutable fields, because a tenant that outgrows a hand-kept list turns it into
 * a rule-based segment. The service refuses that particular change while hand-written membership rows
 * exist, and refuses a code change on a group the platform maintains.
 */
export class UpdateContactGroupDTO extends TenantOrganizationBaseDTO {
	/**
	 * The display name of the group.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	readonly name?: string;

	/**
	 * The stable key the group is addressed by. Refused on a group the platform maintains.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	readonly code?: string;

	/**
	 * What the group is for.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;

	/**
	 * Whether membership becomes explicit or computed.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ContactGroupType })
	@IsOptional()
	@IsEnum(ContactGroupType)
	readonly type?: ContactGroupType;

	/**
	 * The price list granted to the group's members.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly priceListId?: ID;

	/**
	 * The group-wide discount, as a fraction between 0 and 1.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0, maximum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	@Max(1)
	readonly discountPercent?: number;

	/**
	 * Tenant-defined extras, replaced whole.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * The narrowing members of the group list, in the flat spelling.
 */
export class ContactGroupFilterDTO {
	/**
	 * Restrict to one kind of membership.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ContactGroupType })
	@IsOptional()
	@IsEnum(ContactGroupType)
	readonly type?: ContactGroupType;

	/**
	 * Restrict to the groups that grant one price list.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly priceListId?: ID;

	/**
	 * Restrict to the groups the platform maintains, or to the ones it does not. Read with the
	 * platform's own boolean reader, because a query string carries text.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly isSystem?: boolean;

	/**
	 * Restrict to the groups whose code, name or description contains this text.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly search?: string;
}

/**
 * The query of `GET /contact-groups`.
 *
 * Both spellings of the same filter are accepted: the flat one this platform's delivered list routes
 * are called with, and the bracketed one (`?filter[type]=RULE_BASED`) the endpoint table names for the
 * resource. The free-text narrowing is accepted as `q` as well as `search`, because `q` is the
 * spelling the contact rows of the same section use.
 *
 * **`expand` is accepted and is refused, deliberately.** The endpoint table names `expand=rules,members`
 * for the list and `expand=rules` for the detail; neither relation is reachable from this module (see
 * the controller), and a body that asks for one is answered with the query protocol's own
 * `QUERY_EXPAND_NOT_ALLOWED` rather than being silently stripped — a caller must not be told it
 * expanded something it did not.
 */
export class ContactGroupQueryDTO extends ContactGroupFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => ContactGroupFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => ContactGroupFilterDTO)
	readonly filter?: ContactGroupFilterDTO;

	/**
	 * The free-text narrowing, under the spelling the contact rows use.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly q?: string;

	/**
	 * The relations the caller asks to attach. Refused: this resource offers none.
	 */
	@ApiPropertyOptional({ type: () => [String], enum: ['rules', 'members'] })
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
	@IsString({ each: true })
	readonly expand?: string[];

	/**
	 * How many groups to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	/**
	 * How many groups to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}
