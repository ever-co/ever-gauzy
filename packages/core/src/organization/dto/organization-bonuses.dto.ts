import { BonusTypeEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsEnum, IsNumber, Min, Max } from "class-validator";

export class OrganizationBonusesDTO {

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100)
	readonly bonusPercentage: number;

    @ApiProperty({ type: () => String, enum: BonusTypeEnum, readOnly: true })
	@IsOptional()
	@IsEnum(BonusTypeEnum)
	readonly bonusType: BonusTypeEnum;
}