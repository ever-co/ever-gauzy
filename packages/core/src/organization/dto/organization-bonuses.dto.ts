import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsEnum, IsNumber, Min, Max, ValidateIf } from "class-validator";
import { BonusTypeEnum, DEFAULT_PROFIT_BASED_BONUS } from "@gauzy/contracts";

/**
 * Organization Bonuses DTO validation
 */
export class OrganizationBonusesDTO {

    @ApiPropertyOptional({
		type: () => Number,
		example: DEFAULT_PROFIT_BASED_BONUS
	})
    @ValidateIf((it) => it.bonusType)
	@IsNumber()
	@Min(0)
	@Max(100)
	readonly bonusPercentage: number;

    @ApiPropertyOptional({
		enum: BonusTypeEnum,
		example: BonusTypeEnum.PROFIT_BASED_BONUS
	})
	@IsOptional()
	@IsEnum(BonusTypeEnum)
	readonly bonusType: BonusTypeEnum;
}