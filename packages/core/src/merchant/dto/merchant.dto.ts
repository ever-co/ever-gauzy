import { CurrenciesEnum, IImageAsset, IMerchant } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Merchant request DTO validation
 */
export class MerchantDTO extends TenantOrganizationBaseDTO implements IMerchant {

    @ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly name: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
	@IsString()
	readonly code: string;

    @ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
    @IsEmail()
	readonly email: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	readonly phone: string;

    @ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	readonly description: string;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
	@IsBoolean()
	readonly active: boolean;

    @ApiProperty({ type: () => String })
	@IsEnum(CurrenciesEnum)
	readonly currency: CurrenciesEnum;

	@ApiPropertyOptional({ type: () => Object, readOnly: true })
	@IsOptional()
	readonly logo: IImageAsset

	@ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	readonly logoId: IImageAsset['id']
}