import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { CarrierManifestStatus } from '../../warehouse.types';

/**
 * A carrier manifest as a caller sees it.
 *
 * The three counters and the total weight are caches of the member shipments: they are re-derived, and
 * they are frozen when the manifest closes, which is the moment membership stops being a query and
 * becomes a recorded fact.
 */
export class CarrierManifestDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly carrier?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly service?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly number?: string;

	@ApiPropertyOptional({ type: () => String, enum: CarrierManifestStatus })
	@IsOptional()
	@IsEnum(CarrierManifestStatus)
	readonly status?: CarrierManifestStatus;

	@ApiPropertyOptional({ type: () => Date, description: 'The dispatch day the manifest covers.' })
	@IsOptional()
	@IsDate()
	readonly manifestDate?: Date;

	@ApiPropertyOptional({ type: () => Date, description: 'Start of the window a draft collects from.' })
	@IsOptional()
	@IsDate()
	readonly windowFrom?: Date;

	@ApiPropertyOptional({ type: () => Date, description: 'End of that window, exclusive.' })
	@IsOptional()
	@IsDate()
	readonly windowTo?: Date;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly shipmentCount?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly packageCount?: number;

	@ApiPropertyOptional({ type: () => String, description: 'Sum of the members\' packed weights, e.g. "12.4000".' })
	@IsOptional()
	@IsString()
	readonly totalWeight?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly closedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly handedOverAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly canceledAt?: Date;

	@ApiPropertyOptional({ type: () => String, maxLength: 1024 })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	readonly documentUrl?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly documentData?: Record<string, unknown>;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly version?: number;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
