import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsDate,
	IsEnum,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min,
	ValidateNested
} from 'class-validator';
import { ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { EntitlementKind, EntitlementStatus, LicenceKeyFormat } from '../../entitlement.enums';

/**
 * One condition attached to a right.
 *
 * Conditions are `rule` rows, not a column: the subject of an entitlement is a foreign key and what
 * restricts it is the platform's rule language, which is what keeps an entitlement condition and a
 * promotion condition from meaning two different things by "matches".
 */
export class EntitlementConditionDTO {
	@ApiProperty({ type: () => String, description: 'Dotted path into the evaluation context, e.g. `context.region`.' })
	@IsString()
	readonly attribute: string;

	@ApiProperty({ type: () => String, description: 'The comparison, e.g. `EQ`, `IN`, `GTE`, `IS_NULL`.' })
	@IsString()
	readonly operator: string;

	@ApiPropertyOptional({ type: () => Object, description: 'The operand; an array for `IN` and `BETWEEN`.' })
	@IsOptional()
	readonly value?: unknown;

	@ApiPropertyOptional({ type: () => String, description: 'How the operand is coerced: `STRING`, `NUMBER`, `DATE`, ...' })
	@IsOptional()
	@IsString()
	readonly valueType?: string;

	@ApiPropertyOptional({ type: () => Boolean, description: 'Wraps the rule in `NOT` after the operator is applied.' })
	@IsOptional()
	@IsBoolean()
	readonly isNegated?: boolean;

	@ApiPropertyOptional({ type: () => Number, description: 'Rules sharing a group are AND-ed; groups are OR-ed.' })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly groupIndex?: number;

	@ApiPropertyOptional({ type: () => Number, description: 'Evaluation order inside a group.' })
	@IsOptional()
	@IsInt()
	readonly priority?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;
}

/**
 * An entitlement as a caller sees it.
 *
 * Every lifecycle field is readable but not settable by a client: a right moves through its states
 * by being activated, suspended, extended or revoked, and each of those is an action with its own
 * permission rather than a field a body may carry.
 */
export class EntitlementDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly customerId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderLineId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly subscriptionId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly productId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 32, description: 'Allocated from the `ENTITLEMENT` series.' })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly number?: string;

	@ApiPropertyOptional({ type: () => String, enum: EntitlementKind })
	@IsOptional()
	@IsEnum(EntitlementKind)
	readonly kind?: EntitlementKind;

	@ApiPropertyOptional({ type: () => Number, minimum: 0, description: 'Seats, uses or `1`; `0` means unlimited.' })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly quantity?: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly startsAt?: Date;

	@ApiPropertyOptional({ type: () => Date, description: 'Null is the perpetual case.' })
	@IsOptional()
	@IsDate()
	readonly endsAt?: Date;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly gracePeriodDays?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 0, description: 'Tighter than `quantity` when it is set.' })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly activationLimit?: number;

	@ApiPropertyOptional({ type: () => String, enum: EntitlementStatus })
	@IsOptional()
	@IsEnum(EntitlementStatus)
	readonly status?: EntitlementStatus;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly revokedReason?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly suspendedReason?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;

	@ApiPropertyOptional({ type: () => [EntitlementConditionDTO] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => EntitlementConditionDTO)
	readonly conditions?: EntitlementConditionDTO[];

	@ApiPropertyOptional({ type: () => Boolean, description: 'Issue a licence key in the same transaction.' })
	@IsOptional()
	@IsBoolean()
	readonly issueKey?: boolean;

	@ApiPropertyOptional({ type: () => String, enum: LicenceKeyFormat })
	@IsOptional()
	@IsEnum(LicenceKeyFormat)
	readonly keyFormat?: LicenceKeyFormat;

	@ApiPropertyOptional({ type: () => String, description: 'The holder an issued key is assigned to.' })
	@IsOptional()
	@IsString()
	@MaxLength(320)
	readonly assignedToEmail?: string;

	@ApiPropertyOptional({ type: () => Boolean, description: 'Grant the right already in force instead of `PENDING`.' })
	@IsOptional()
	@IsBoolean()
	readonly activateImmediately?: boolean;
}
