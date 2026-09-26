import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * The reference unit a new family is created with.
 *
 * It is part of the family's create body rather than a second request because a family with no
 * reference has no base quantity: the two rows are one decision, and a service that accepted them
 * separately would leave a window in which every quantity in the family means nothing.
 */
export class CreateUnitCategoryReferenceDTO {
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

	@ApiPropertyOptional({ type: () => Number, minimum: 0, maximum: 6, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(6)
	readonly decimalPlaces?: number;
}

/**
 * A measurement family as an operator declares it.
 */
export class CreateUnitCategoryDTO extends TenantOrganizationBaseDTO {
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

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isSystem?: boolean;

	@ApiProperty({ type: () => CreateUnitCategoryReferenceDTO })
	@Type(() => CreateUnitCategoryReferenceDTO)
	@IsObject()
	readonly reference: CreateUnitCategoryReferenceDTO;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * A measurement family as an operator changes it.
 *
 * The reference unit is deliberately absent: changing which unit defines a family's base quantity
 * restates every quantity already expressed in it, which is a migration and not an update.
 */
export class UpdateUnitCategoryDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	readonly name?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}
