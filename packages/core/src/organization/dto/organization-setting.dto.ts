import { DefaultValueDateTypeEnum, DEFAULT_INVITE_EXPIRY_PERIOD, WeekDaysEnum } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
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

	/**
	 * Default Organization Invite Expiry Period
	 */
    @ApiPropertyOptional({
		type: () => Number,
		example: DEFAULT_INVITE_EXPIRY_PERIOD
	})
	@IsOptional()
	@Transform((params: TransformFnParams) => parseInt(params.value, 10))
	readonly inviteExpiryPeriod: number = DEFAULT_INVITE_EXPIRY_PERIOD;
}