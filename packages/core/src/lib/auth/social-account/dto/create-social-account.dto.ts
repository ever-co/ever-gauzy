import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsObject, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { ID, ISocialAccountCreateInput, ProviderEnum } from '@gauzy/contracts';
import { TenantBaseDTO } from '../../../core/dto';
import { CreateUserDTO } from '../../../user/dto';

/**
 * Create Social Account DTO validation
 */
export class CreateSocialAccountDTO extends IntersectionType(TenantBaseDTO) implements ISocialAccountCreateInput {
	/**
	 * Create user to the social account
	 */
	@ApiPropertyOptional({ type: () => CreateUserDTO })
	@ValidateIf((it) => !it.userId)
	@IsObject()
	@ValidateNested()
	@Type(() => CreateUserDTO)
	readonly user: CreateUserDTO;

	/**
	 * Sync user to the social account
	 */
	@ApiPropertyOptional({ type: () => String })
	@ValidateIf((it) => !it.user)
	@IsNotEmpty()
	@IsString()
	readonly userId: ID;

	/**
	 * Social account provider
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsEnum(ProviderEnum, { message: 'provider `$value` must be a valid enum value' })
	readonly provider: ProviderEnum;

	/**
	 * Social account provider account id
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly providerAccountId: string;
}
