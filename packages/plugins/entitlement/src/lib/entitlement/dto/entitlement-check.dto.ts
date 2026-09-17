import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * The body of `POST /entitlements/check`.
 *
 * A caller holds either a licence key or an entitlement, never neither: the reference is required,
 * which is why a malformed body is a `400` and not a `404`. The answer to a well-formed request for
 * something that is not entitled is always `200` with `allowed: false` — a denial is an answer, and
 * answering it with a not-found would make "you may not" and "there is no such right"
 * indistinguishable to the client that has to act on it.
 */
export class CheckEntitlementDTO {
	@ApiPropertyOptional({ type: () => String, description: 'The right being checked.' })
	@IsOptional()
	@IsUUID()
	readonly entitlementId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'The licence key the caller holds, in clear.' })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly key?: string;

	@ApiPropertyOptional({ type: () => String, description: 'The device or instance asking.' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly deviceId?: string;

	@ApiPropertyOptional({ type: () => String, description: 'The named seat asking.' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly seatReference?: string;

	@ApiPropertyOptional({
		type: () => Object,
		description: 'Attributes the attached `rule` rows are evaluated against, merged over the derived context.'
	})
	@IsOptional()
	@IsObject()
	readonly context?: Record<string, unknown>;
}
