import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CouponDTO } from './coupon.dto';

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
	@Type(() => Number)
	@IsInt()
	@Min(1)
	readonly significantLength?: number;

	@ApiPropertyOptional({ type: () => Number, description: 'Characters per group.' })
	@IsOptional()
	@Type(() => Number)
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
 * the format. The window is converted from its wire form, which the unvalidated route accepted, so a
 * request that worked before keeps working.
 */
export class CreateCouponBatchDTO extends OmitType(CouponDTO, ['code', 'usageCount', 'startsAt', 'endsAt'] as const) {
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
	@Type(() => Number)
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
