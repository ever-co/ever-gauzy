import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { EntitlementKind } from '../../entitlement.enums';
import { EntitlementDTO } from './entitlement.dto';

/**
 * A grant.
 *
 * The number is allocated by the service from the `ENTITLEMENT` series, so a caller never supplies
 * one, and the provenance — the order, the line, the subscription — is what makes a replayed grant
 * return the original right instead of a second one. The one case a caller grants without a purchase
 * behind it is the operator grant the `ENTITLEMENTS_GRANT` permission exists for.
 */
export class CreateEntitlementDTO extends EntitlementDTO {
	@ApiPropertyOptional({ type: () => String, description: 'The party the right is granted to.' })
	@IsOptional()
	@IsUUID()
	readonly customerId?: ID;

	@ApiPropertyOptional({ type: () => String, enum: EntitlementKind, default: EntitlementKind.LICENCE })
	@IsOptional()
	@IsEnum(EntitlementKind)
	readonly kind?: EntitlementKind;

	@ApiPropertyOptional({ type: () => Number, minimum: 0, default: 1 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly quantity?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 0, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly gracePeriodDays?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly activationLimit?: number;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly issueKey?: boolean;

	@ApiPropertyOptional({ type: () => String, description: 'The holder an issued key is assigned to.' })
	@IsOptional()
	@IsEmail()
	readonly assignedToEmail?: string;
}
