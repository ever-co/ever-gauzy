import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	Matches,
	MaxLength,
	ValidateNested
} from 'class-validator';
import { ITermsAcceptanceClaim } from '@gauzy/contracts';

/** One-time keys are 43 base64url characters; anything far outside that is refused before any lookup. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export class HandoffDTO {
	@ApiProperty({ type: () => String, description: 'One-time key from the redirect' })
	@IsString()
	@Matches(KEY_PATTERN)
	readonly handoff: string;
}

export class ConfirmDTO extends HandoffDTO {
	@ApiProperty({ type: () => String, description: "Gauzy's one-time e-mail code" })
	@IsString()
	@Length(1, 64)
	readonly code: string;
}

/** A legal document the confirmation page displayed (re-checked by Gauzy's register path). */
export class SignupTermsClaimDTO implements ITermsAcceptanceClaim {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly documentId: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	readonly version: string;

	@ApiProperty({ type: () => String })
	@Matches(/^[0-9a-f]{64}$/)
	readonly sha256: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(35)
	readonly locale: string;
}

export class SignupDTO extends HandoffDTO {
	@ApiProperty({ type: () => Boolean, description: 'Must be true: the person confirmed creating a workspace' })
	@IsBoolean()
	readonly confirm: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	readonly firstName?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	readonly lastName?: string;

	@ApiPropertyOptional({ type: () => [SignupTermsClaimDTO] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(10)
	@ValidateNested({ each: true })
	@Type(() => SignupTermsClaimDTO)
	readonly terms?: SignupTermsClaimDTO[];
}

/** Longest accepted value of a branding field (the plugin keeps shorter ones, see the token route). */
const MAX_BRANDING_LENGTH = 2048;

export class TokenSigninDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(16_384)
	readonly id_token?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(16_384)
	readonly access_token?: string;

	@ApiPropertyOptional({ type: () => String, description: "The calling app's name, for Gauzy's one-time code e-mail" })
	@IsOptional()
	@IsString()
	@MaxLength(MAX_BRANDING_LENGTH)
	readonly appName?: string;

	@ApiPropertyOptional({ type: () => String, description: "The calling app's logo (https), for the code e-mail" })
	@IsOptional()
	@IsString()
	@MaxLength(MAX_BRANDING_LENGTH)
	readonly appLogo?: string;

	@ApiPropertyOptional({ type: () => String, description: "The calling app's signature line, for the code e-mail" })
	@IsOptional()
	@IsString()
	@MaxLength(MAX_BRANDING_LENGTH)
	readonly appSignature?: string;

	@ApiPropertyOptional({ type: () => String, description: "The calling app's address (https), for the code e-mail" })
	@IsOptional()
	@IsString()
	@MaxLength(MAX_BRANDING_LENGTH)
	readonly appLink?: string;

	@ApiPropertyOptional({ type: () => String, description: "The calling app's company name, for the code e-mail" })
	@IsOptional()
	@IsString()
	@MaxLength(MAX_BRANDING_LENGTH)
	readonly companyName?: string;

	@ApiPropertyOptional({ type: () => String, description: "The calling app's company address (https), for the code e-mail" })
	@IsOptional()
	@IsString()
	@MaxLength(MAX_BRANDING_LENGTH)
	readonly companyLink?: string;
}

export class LinkPreviewDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	@Matches(KEY_PATTERN)
	readonly key: string;
}

export class LinkConfirmDTO extends LinkPreviewDTO {
	@ApiPropertyOptional({ type: () => [String], description: 'Same-address accounts to link as well' })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(100)
	@IsUUID('all', { each: true })
	readonly rows?: string[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Length(1, 64)
	readonly code?: string;
}

export class BackchannelLogoutDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(16_384)
	readonly logout_token: string;
}
