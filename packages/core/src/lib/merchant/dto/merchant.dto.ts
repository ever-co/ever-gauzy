import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IImageAsset, IMerchant } from "@gauzy/contracts";
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { RelationalCurrencyDTO } from "./../../currency/dto";
import { TenantOrganizationBaseDTO } from "./../../core/dto";
import { RelationalTagDTO } from "./../../tags/dto";

/**
 * Merchant request DTO validation
 */
export class MerchantDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
    RelationalCurrencyDTO,
	RelationalTagDTO
) implements IMerchant {

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

    @ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	readonly description: string;

    @ApiProperty({ type: () => Boolean, readOnly: true })
	@IsOptional()
	@IsBoolean()
	readonly active: boolean;

	@ApiPropertyOptional({ type: () => Object, readOnly: true })
	@IsOptional()
	readonly logo: IImageAsset;

	@ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	readonly logoId: IImageAsset['id'];
}