import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DecimalString, ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * A unit as an operator declares it.
 *
 * `factor` arrives as a string because it is an exact decimal: a `number` would make `1 oz =
 * 28.349523125 g` unrepresentable the moment it passed through a float, and the factor is the one
 * value a conversion is computed from.
 */
export class CreateUnitDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly categoryId: ID;

	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(32)
	readonly code: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	readonly name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	readonly symbol?: string;

	@ApiPropertyOptional({ type: () => String, default: '1' })
	@IsOptional()
	@IsString()
	readonly factor?: DecimalString;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isReference?: boolean;

	@ApiPropertyOptional({ type: () => Number, minimum: 0, maximum: 6, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(6)
	readonly decimalPlaces?: number;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isSystem?: boolean;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * A unit as an operator changes it.
 *
 * The family is absent on purpose: moving a unit between families changes what every quantity
 * expressed in it means, so it is a new unit and an archive of the old one, not an update.
 */
export class UpdateUnitDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	readonly name?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	readonly symbol?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly factor?: DecimalString;

	@ApiPropertyOptional({ type: () => Number, minimum: 0, maximum: 6 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(6)
	readonly decimalPlaces?: number;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * A quantity and the two units it is converted between.
 */
export class ConvertQuantityDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	readonly value: DecimalString;

	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly fromUnitId: ID;

	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly toUnitId: ID;
}
