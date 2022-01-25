import { DefaultValueDateTypeEnum, RegionsEnum, WeekDaysEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsEnum } from "class-validator";

export abstract class OrganizationSettingDTO {

    @ApiProperty({ type: () => String, enum: DefaultValueDateTypeEnum })
	@IsEnum(DefaultValueDateTypeEnum)
	readonly defaultValueDateType: DefaultValueDateTypeEnum;

    @ApiProperty({ type: () => String, enum: WeekDaysEnum })
	@IsOptional()
	@IsEnum(WeekDaysEnum)
	readonly startWeekOn: WeekDaysEnum;

    @ApiProperty({ type: () => String, enum: RegionsEnum })
	@IsOptional()
	@IsEnum(RegionsEnum)
	readonly regionCode: RegionsEnum;
}