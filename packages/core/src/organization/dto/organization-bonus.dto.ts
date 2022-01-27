import { BonusTypeEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsEnum, IsNumber, Min, Max } from "class-validator";
import { OrganizationSettingDTO } from "./organization-setting.dto";

export abstract class OrganizationBounsDTO extends OrganizationSettingDTO {

    @ApiProperty({ type: () => Number })
    @IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100)
	readonly bonusPercentage: number;

    @ApiProperty({ type: () => String, enum: BonusTypeEnum })
	@IsOptional()
	@IsEnum(BonusTypeEnum)
	readonly bonusType: BonusTypeEnum;
}