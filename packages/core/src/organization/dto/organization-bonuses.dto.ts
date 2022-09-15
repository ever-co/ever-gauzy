import { BonusTypeEnum } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsEnum, IsNumber, Min, Max } from "class-validator";

export class OrganizationBonusesDTO {

    @ApiPropertyOptional({ type: () => Number, readOnly: true })
    @IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100)
	readonly bonusPercentage: number;

    @ApiPropertyOptional({ type: () => String, enum: BonusTypeEnum, readOnly: true })
	@IsOptional()
	@IsEnum(BonusTypeEnum)
	readonly bonusType: BonusTypeEnum;
}