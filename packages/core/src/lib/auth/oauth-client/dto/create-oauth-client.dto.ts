/**
 * DTO for `POST /oauth/clients` — register a new third-party OAuth app.
 *
 * Note: `clientId`, `clientSecret`, and `codeSecret` are NOT accepted from
 * the client. They are generated server-side by `OAuthClientService.create`
 * and the plaintext secret is returned exactly once via the response DTO.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUrl,
	MaxLength,
	Min
} from 'class-validator';
import { IOAuthClientCreateInput, OAuthClientType, OAuthGrantType } from '@gauzy/contracts';

export class CreateOAuthClientDTO implements IOAuthClientCreateInput {
	@ApiProperty({ type: String, maxLength: 100, example: 'Activepieces' })
	@IsString()
	@MaxLength(100)
	name: string;

	@ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	description?: string | null;

	@ApiPropertyOptional({ enum: OAuthClientType, default: OAuthClientType.CONFIDENTIAL })
	@IsOptional()
	@IsEnum(OAuthClientType)
	clientType?: OAuthClientType;

	@ApiProperty({
		type: [String],
		example: ['https://cloud.activepieces.com/redirect']
	})
	@IsArray()
	@ArrayNotEmpty()
	@IsUrl({ require_tld: false }, { each: true })
	redirectUris: string[];

	@ApiPropertyOptional({ type: [String], example: ['profile', 'email'] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	allowedScopes?: string[];

	@ApiPropertyOptional({
		enum: OAuthGrantType,
		isArray: true,
		default: [OAuthGrantType.AUTHORIZATION_CODE]
	})
	@IsOptional()
	@IsArray()
	@IsEnum(OAuthGrantType, { each: true })
	allowedGrantTypes?: OAuthGrantType[];

	@ApiPropertyOptional({ type: Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	pkceRequired?: boolean;

	@ApiPropertyOptional({ type: Number, default: 86400, minimum: 60 })
	@IsOptional()
	@IsInt()
	@Min(60)
	accessTokenTtl?: number;

	@ApiPropertyOptional({ type: Number, default: 2592000, minimum: 60 })
	@IsOptional()
	@IsInt()
	@Min(60)
	refreshTokenTtl?: number;
}
