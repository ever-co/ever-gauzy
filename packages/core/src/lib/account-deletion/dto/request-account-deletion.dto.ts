import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { IAccountDeletionRequestInput, LanguagesEnum } from '@gauzy/contracts';

/**
 * Body of `POST /account-deletion/request`. Only `email` is required; the other fields brand the email
 * (the same ones the sign-in code request takes), and `callbackUrl` names the front end's confirmation
 * page. Every link is checked against the origins this deployment serves before it is used.
 */
export class RequestAccountDeletionDTO implements IAccountDeletionRequestInput {
	@ApiProperty({ type: () => String, example: 'jane@example.com' })
	@IsNotEmpty()
	@IsEmail()
	@MaxLength(254)
	@Transform((params: TransformFnParams) => (typeof params.value === 'string' ? params.value.trim() : params.value))
	readonly email: string;

	@ApiPropertyOptional({ type: () => String, example: 'https://app.ever.team/delete-account/confirm' })
	@IsOptional()
	@IsString()
	@MaxLength(2048)
	readonly callbackUrl?: string;

	@ApiPropertyOptional({ enum: LanguagesEnum })
	@IsOptional()
	@IsEnum(LanguagesEnum)
	readonly locale?: LanguagesEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly appName?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(2048)
	readonly appLogo?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly appSignature?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(2048)
	readonly appLink?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(2048)
	readonly companyLink?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly companyName?: string;
}
