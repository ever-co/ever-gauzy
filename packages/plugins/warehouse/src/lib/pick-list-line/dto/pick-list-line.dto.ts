import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDate, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PickListLineStatus } from '../../warehouse.types';

/**
 * A pick line as a caller sees it.
 *
 * The three quantities are exact decimal strings. `quantityPicked + quantityShort` equals
 * `quantityRequested` for every line that reached an outcome, which is the invariant the whole domain
 * is stated over; while a line is still pending both are zero.
 */
export class PickListLineDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly pickListId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderLineId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly fulfillmentLineId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly binId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly zoneId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'What the list asks for, e.g. "5.000000".' })
	@IsOptional()
	@IsString()
	readonly quantityRequested?: string;

	@ApiPropertyOptional({ type: () => String, description: 'What was actually collected.' })
	@IsOptional()
	@IsString()
	readonly quantityPicked?: string;

	@ApiPropertyOptional({ type: () => String, description: 'The shortfall.' })
	@IsOptional()
	@IsString()
	readonly quantityShort?: string;

	@ApiPropertyOptional({ type: () => String, enum: PickListLineStatus })
	@IsOptional()
	@IsEnum(PickListLineStatus)
	readonly status?: PickListLineStatus;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly substituteVariantId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Quantity of the substitute.' })
	@IsOptional()
	@IsString()
	readonly substituteQuantity?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly substitutionReason?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly packSlipId?: ID;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly position?: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly pickedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly pickedByUserId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly lotNumber?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly expiryDate?: Date;

	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	readonly serialNumbers?: string[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
