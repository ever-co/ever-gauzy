import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** The body of `POST /entitlement-activations/:id/release`, a clean release by the holder. */
export class ReleaseEntitlementActivationDTO {
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly reason?: string;
}

/** The body of `POST /entitlement-activations/:id/revoke`, a release imposed by support or by a policy. */
export class RevokeEntitlementActivationDTO {
	@ApiProperty({ type: () => String, maxLength: 255, description: 'Why the slot was taken away.' })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly reason: string;
}
