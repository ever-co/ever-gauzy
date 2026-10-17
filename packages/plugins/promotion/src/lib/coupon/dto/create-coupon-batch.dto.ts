import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OmitType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { CouponDTO } from './coupon.dto';

/**
 * Reads a whole number from its wire forms: a JSON number, or a numeric string as the unvalidated route
 * accepted. Anything else — `true`, `[1]` — is left as it came, so `@IsInt` refuses it rather than a
 * blanket `Number()` turning it into 1.
 */
const toWholeNumber = ({ value }: { value: unknown }) =>
	typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : value;

/** The largest batch the service mints in one request; the service states the same bound. */
export const COUPON_BATCH_MAX_COUNT = 100000;

/**
 * The format a batch's codes are minted in: the `CouponCodeFormatInput` of the GraphQL document.
 */
export class CouponCodeFormatDTO {
	@ApiPropertyOptional({ type: () => String, description: 'Regular expression every generated code matches.' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly pattern?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Alphabet the significant characters are drawn from.' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly alphabet?: string;

	@ApiPropertyOptional({ type: () => Number, description: 'Number of significant characters.' })
	@IsOptional()
	@Transform(toWholeNumber)
	@IsInt()
	@Min(1)
	readonly significantLength?: number;

	@ApiPropertyOptional({ type: () => Number, description: 'Characters per group.' })
	@IsOptional()
	@Transform(toWholeNumber)
	@IsInt()
	@Min(1)
	readonly groupSize?: number;

	@ApiPropertyOptional({ type: () => String, description: 'Separator between groups.' })
	@IsOptional()
	@IsString()
	@MaxLength(8)
	readonly separator?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Optional fixed prefix.' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly prefix?: string | null;

	@ApiPropertyOptional({ type: () => String, description: 'Optional fixed suffix.' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly suffix?: string | null;
}

/**
 * The request body of `POST /coupons/batch`: the `CreateCouponBatchInput` of the GraphQL document.
 *
 * The route used to type its body as `CreateCouponDTO & { count; couponCodeFormat }`. An intersection is
 * not a class, so the validation pipe had nothing to validate against and the body reached the service
 * as it came — unknown members included (R2-G34). This class is the same shape the GraphQL input states:
 * the coupon's shared fields, `code` accepted and never read (a batch mints its own codes), the count and
 * the format. The window and the count are converted from their wire forms, which the unvalidated route
 * accepted, so a request that worked before keeps working.
 *
 * **The organization is not required here.** The base DTO requires `organization` or `organizationId`, and
 * the unvalidated route never did: the service writes every generated code into the caller's own scope and
 * ignores whatever tenancy the body states. The three members are therefore left out of the inherited shape,
 * and `organizationId` is accepted back as an optional identifier so a client that sends it is not refused.
 */
export class CreateCouponBatchDTO extends OmitType(CouponDTO, [
	'code',
	'usageCount',
	'startsAt',
	'endsAt',
	'organization',
	'organizationId',
	'sentTo'
] as const) {
	@ApiPropertyOptional({
		type: () => String,
		description: 'Accepted and never read: the caller’s organization is used.'
	})
	@IsOptional()
	@IsUUID()
	readonly organizationId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Accepted and never read: a batch mints its own codes.' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code?: string;

	@ApiPropertyOptional({ type: () => Date, description: 'Start of the window every code shares.' })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	readonly startsAt?: Date;

	@ApiPropertyOptional({ type: () => Date, description: 'End of the window every code shares, exclusive.' })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	readonly endsAt?: Date;

	@ApiProperty({ type: () => Number, description: 'How many codes to mint.' })
	@Transform(toWholeNumber)
	@IsInt()
	@Min(1)
	@Max(COUPON_BATCH_MAX_COUNT)
	readonly count: number;

	@ApiPropertyOptional({ type: () => CouponCodeFormatDTO, description: 'The format the codes are minted in.' })
	@IsOptional()
	@ValidateNested()
	@Type(() => CouponCodeFormatDTO)
	readonly couponCodeFormat?: CouponCodeFormatDTO;
}
