import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LicenceKeyFormat } from '../../entitlement.enums';

/** The body of `POST /entitlement-keys/:id/reissue`. */
export class ReissueEntitlementKeyDTO {
	@ApiPropertyOptional({ type: () => String, enum: LicenceKeyFormat })
	@IsOptional()
	@IsEnum(LicenceKeyFormat)
	readonly format?: LicenceKeyFormat;

	@ApiPropertyOptional({ type: () => String, description: 'Why the key is being replaced, kept on the old row.' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly reason?: string;

	@ApiPropertyOptional({
		type: () => Boolean,
		default: false,
		description: 'Store a recoverable ciphertext for the replacement key.'
	})
	@IsOptional()
	readonly storeKey?: boolean;
}

/** The body of `POST /entitlement-keys/:id/revoke`. */
export class RevokeEntitlementKeyDTO {
	@ApiProperty({ type: () => String, maxLength: 255, description: 'Why the credential was withdrawn.' })
	@IsString()
	@MaxLength(255)
	readonly reason: string;
}

/** The body of `PUT /entitlement-keys/:id`, which records who holds the key. */
export class AssignEntitlementKeyDTO {
	@ApiPropertyOptional({ type: () => String, maxLength: 320 })
	@IsOptional()
	@IsString()
	@MaxLength(320)
	readonly assignedToEmail?: string;
}
