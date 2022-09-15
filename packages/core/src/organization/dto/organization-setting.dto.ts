import { DefaultValueDateTypeEnum, WeekDaysEnum } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsEnum, IsString } from "class-validator";

/**
 * Organization Setting DTO
 */
export class OrganizationSettingDTO {

	@ApiProperty({ type: () => String, enum: DefaultValueDateTypeEnum, readOnly: true })
	@IsEnum(DefaultValueDateTypeEnum)
	readonly defaultValueDateType: DefaultValueDateTypeEnum;

	@ApiPropertyOptional({ type: () => String, enum: WeekDaysEnum, readOnly: true })
	@IsOptional()
	@IsEnum(WeekDaysEnum)
	readonly startWeekOn: WeekDaysEnum;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly regionCode: string;
}