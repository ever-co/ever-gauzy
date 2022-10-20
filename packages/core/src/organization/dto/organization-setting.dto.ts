import { DefaultValueDateTypeEnum, WeekDaysEnum } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsEnum, IsString } from "class-validator";

/**
 * Organization Setting DTO validation
 */
export class OrganizationSettingDTO {

	@ApiPropertyOptional({
		enum: DefaultValueDateTypeEnum,
		example: DefaultValueDateTypeEnum.TODAY,
		required: true
	})
	@IsOptional()
	@IsEnum(DefaultValueDateTypeEnum)
	readonly defaultValueDateType: DefaultValueDateTypeEnum;

	@ApiPropertyOptional({
		enum: WeekDaysEnum,
		example: WeekDaysEnum.MONDAY
	})
	@IsOptional()
	@IsEnum(WeekDaysEnum)
	readonly startWeekOn: WeekDaysEnum;

    @ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly regionCode: string;
}