import { DefaultValueDateTypeEnum, WeekDaysEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsEnum, IsString } from "class-validator";

/**
 * Organization Setting DTO
 */
export class OrganizationSettingDTO {

	@ApiProperty({ type: () => String, enum: DefaultValueDateTypeEnum, readOnly: true })
	@IsEnum(DefaultValueDateTypeEnum)
	readonly defaultValueDateType: DefaultValueDateTypeEnum;

	@ApiProperty({ type: () => String, enum: WeekDaysEnum, readOnly: true })
	@IsOptional()
	@IsEnum(WeekDaysEnum)
	readonly startWeekOn: WeekDaysEnum;

    @ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly regionCode: string;
}