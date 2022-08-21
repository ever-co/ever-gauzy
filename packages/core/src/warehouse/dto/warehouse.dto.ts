import { IImageAsset } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Warehouse request DTO validation
 */
export class WarehouseDTO extends TenantOrganizationBaseDTO {

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
	readonly description: string;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
	@IsOptional()
	@IsBoolean()
	readonly active: boolean;

	@ApiPropertyOptional({ type: () => Object, readOnly: true })
	@IsOptional()
	readonly logo: IImageAsset

	@ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	readonly logoId: IImageAsset['id']
}