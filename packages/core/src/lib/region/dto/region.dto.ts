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
 * What a caller states when it opens a commercial geography.
 *
 * `currency` is required and is an exact three-letter code: the region is where a cart's currency is
 * decided, and a region whose currency the platform's master does not carry has no decimal places, no
 * rounding mode and no tender flag, so the service checks the value against the master before the row
 * is written. The country set is not part of this body — membership is a pivot the region's own
 * operation writes, so a region is created empty and countries are added to it.
 */
export class CreateRegionDTO extends TenantOrganizationBaseDTO {
	/**
	 * Admin-facing name.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	readonly name: string;

	/**
	 * Stable key, unique per organization among the live rows.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	readonly code: string;

	/**
	 * The region's currency: an exact three-letter ISO code, checked against the currency master.
	 */
	@ApiProperty({ type: () => String, maxLength: 3, minLength: 3 })
	@IsString()
	@Length(3, 3)
	readonly currency: CurrencyCode;

	/**
	 * Whether displayed prices include tax in this region. Defaults to false.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isTaxInclusive?: boolean;

	/**
	 * Registered tax-provider strategy key. Absent means the platform's built-in tax engine.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly taxProviderKey?: string;

	/**
	 * Allowed payment-provider codes in this region. An explicit empty list means none; absence means
	 * every enabled provider.
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	readonly paymentProviderKeys?: string[];

	/**
	 * Allowed shipping and carrier provider keys in this region. An explicit empty list means none;
	 * absence means every enabled provider.
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	readonly fulfillmentProviderKeys?: string[];

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * What a caller may change on a region that exists.
 *
 * A currency change is re-checked against the currency master exactly like the creation is, because
 * the rule is about the stored value and not about the moment it first arrived. `isDefault` and
 * `status` are absent: each has an operation of its own.
 */
export class UpdateRegionDTO extends TenantOrganizationBaseDTO {
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
	 * Stable key.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	readonly code?: string;

	/**
	 * The region's currency, re-checked against the currency master.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 3, minLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly currency?: CurrencyCode;

	/**
	 * Whether displayed prices include tax.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTaxInclusive?: boolean;

	/**
	 * Registered tax-provider strategy key.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly taxProviderKey?: string;

	/**
	 * Allowed payment-provider codes, replaced whole.
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	readonly paymentProviderKeys?: string[];

	/**
	 * Allowed shipping and carrier provider keys, replaced whole.
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	readonly fulfillmentProviderKeys?: string[];

	/**
	 * Tenant extras, replaced whole.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * One member of a region's country set, as the whole-set replacement states it.
 */
export class RegionCountryMemberDTO {
	/**
	 * The country to place in the region.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly countryId: ID;

	/**
	 * Whether sales into the country are tax exempt in this region. Defaults to false.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isTaxExempt?: boolean;

	/**
	 * Sub-national scope: absent for the whole country, otherwise a non-empty list of province codes.
	 *
	 * The empty list is refused rather than accepted because it names a scope that contains nothing
	 * while every consumer that tests for absence reads it as "the whole country" — one stored value
	 * with two readings, which is exactly what the service rejects.
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@ArrayMinSize(1)
	@IsString({ each: true })
	readonly provinceCodes?: string[];
}

/**
 * The country set a region serves afterwards.
 *
 * A set rather than a member-per-call pair: writing it member by member would make "remove a country"
 * and "add a country" two calls that can each fail on their own, leaving a set nobody asked for. An
 * empty list is legitimate — a region that serves nowhere is a region being configured.
 */
export class ReplaceRegionCountriesDTO {
	/**
	 * The countries the region serves afterwards.
	 */
	@ApiProperty({ type: () => [RegionCountryMemberDTO] })
	@IsArray()
	@ArrayMinSize(0)
	@ValidateNested({ each: true })
	@Type(() => RegionCountryMemberDTO)
	readonly countries: RegionCountryMemberDTO[];
}

/**
 * The filterable members of the region list, in the flat spelling.
 */
export class RegionFilterDTO {
	/**
	 * Restrict to one lifecycle status.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ChannelStatus })
	@IsOptional()
	@IsEnum(ChannelStatus)
	readonly status?: ChannelStatus;

	/**
	 * Restrict to the region under one code.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code?: string;

	/**
	 * Restrict to the regions that price in one currency.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 3, minLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly currency?: CurrencyCode;

	/**
	 * Restrict to the organization's default region, or to the ones that are not.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly isDefault?: boolean;
}

/**
 * The query of `GET /regions`.
 *
 * Both spellings of the same filter are accepted, as on every list route of this platform.
 */
export class RegionQueryDTO extends RegionFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => RegionFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => RegionFilterDTO)
	readonly filter?: RegionFilterDTO;

	/**
	 * How many regions to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	/**
	 * How many regions to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;

	/**
	 * The relations to attach to each row.
	 */
	@ApiPropertyOptional({ type: () => [String], enum: ['countries'] })
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
	@IsEnum(['countries'], { each: true })
	readonly expand?: string[];
}

/**
 * The query of `GET /regions/:id`.
 */
export class RegionDetailQueryDTO {
	/**
	 * The relations to attach to the region: `countries`.
	 */
	@ApiPropertyOptional({ type: () => [String], enum: ['countries'] })
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
	@IsEnum(['countries'], { each: true })
	readonly expand?: string[];
}

/**
 * The query of `DELETE /regions/:id`.
 */
export class DeleteRegionQueryDTO {
	/**
	 * Whether the caller asks for the strongest removal the resource offers.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly force?: boolean;
}
