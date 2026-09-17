import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsDate,
	IsEnum,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min
} from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { EntitlementActivationStatus } from '../../entitlement.enums';

/**
 * An activation as a caller sees it.
 *
 * The device identity is settable because the client is the only party that knows it; everything
 * else about the row — when the slot was taken, when it was last seen, whether it was released or
 * revoked — is written by the service, which is what makes the support answer "who held this seat,
 * and until when" trustworthy.
 */
export class EntitlementActivationDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly entitlementId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly entitlementKeyId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly deviceId?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly deviceName?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly fingerprint?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly seatReference?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly activatedByCustomerId?: ID;

	@ApiPropertyOptional({ type: () => String, enum: EntitlementActivationStatus })
	@IsOptional()
	@IsEnum(EntitlementActivationStatus)
	readonly status?: EntitlementActivationStatus;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly lastSeenAt?: Date;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly revocationReason?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly ipAddress?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 512 })
	@IsOptional()
	@IsString()
	@MaxLength(512)
	readonly userAgent?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}

/**
 * A request to occupy a slot.
 *
 * The device identity is mandatory and is the identity the limit is counted over, so it is a column
 * rather than a note in `metadata`: a seat check that had to parse a document could not be enforced
 * by an index or repaired by an audit.
 */
export class CreateEntitlementActivationDTO extends EntitlementActivationDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly entitlementId: ID;

	@ApiProperty({ type: () => String, maxLength: 255, description: 'Stable device or instance identifier.' })
	@IsString()
	@MaxLength(255)
	readonly deviceId: string;

	@ApiPropertyOptional({ type: () => String, description: 'The licence key presented, when activation goes through one.' })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly key?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly seatReference?: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 0, description: 'Refresh `lastSeenAt` only after this many seconds.' })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly seenIntervalSeconds?: number;
}
