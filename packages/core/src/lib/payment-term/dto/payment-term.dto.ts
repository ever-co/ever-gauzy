import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsDateString,
	IsEnum,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	Length,
	MaxLength,
	Min,
	MinLength,
	ValidateNested
} from 'class-validator';
import { CurrencyCode, DecimalString, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { PaymentDueBasis, PaymentTermLineType } from '../payment-term.enums';

/**
 * One instalment as an operator supplies it.
 *
 * `valueAmount` and `factor`-style values arrive as strings because they are exact decimals: a
 * percentage of `33.333333` passed through a float would be rounded before it was ever stored, and the
 * allocation that reads it would then be exact about the wrong number.
 */
export class PaymentTermLineDTO {
	@ApiPropertyOptional({ type: () => Number, default: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly sequence?: number;

	@ApiPropertyOptional({ type: () => String, enum: PaymentTermLineType, default: PaymentTermLineType.PERCENT })
	@IsOptional()
	@IsEnum(PaymentTermLineType)
	readonly valueType?: PaymentTermLineType;

	@ApiProperty({ type: () => String })
	@IsString()
	readonly valueAmount: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => String, enum: PaymentDueBasis, default: PaymentDueBasis.INVOICE_DATE })
	@IsOptional()
	@IsEnum(PaymentDueBasis)
	readonly dueBasis?: PaymentDueBasis;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly days?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly dayOfMonth?: number;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * A settlement term as an operator declares it, its instalments included.
 */
export class CreatePaymentTermDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	readonly name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	readonly code: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isDefault?: boolean;

	@ApiProperty({ type: () => [PaymentTermLineDTO] })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => PaymentTermLineDTO)
	readonly lines: PaymentTermLineDTO[];

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * A settlement term as an operator changes it.
 */
export class UpdatePaymentTermDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	readonly name?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	readonly code?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isDefault?: boolean;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * The instalments a term is to carry, as `PUT /payment-terms/:id/lines` receives them.
 */
export class UpdatePaymentTermLinesDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => [PaymentTermLineDTO] })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => PaymentTermLineDTO)
	readonly lines: PaymentTermLineDTO[];
}

/**
 * A preview of the schedule a term produces for one amount.
 */
export class PaymentTermScheduleDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	readonly total: DecimalString;

	@ApiProperty({ type: () => Number, default: 2, minimum: 0, maximum: 6 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly currencyDecimals?: number;

	@ApiProperty({ type: () => String })
	@IsDateString()
	readonly basisDate: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly currency?: CurrencyCode;
}
