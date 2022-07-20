import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

/**
 * Employee Public Setting DTO
 */
export class EmployeePublicSettingDTO {

    @ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	show_anonymous_bonus: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	show_average_bonus: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	show_average_expenses: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	show_average_income: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	show_billrate: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	show_payperiod: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	show_start_work_on: boolean;
}