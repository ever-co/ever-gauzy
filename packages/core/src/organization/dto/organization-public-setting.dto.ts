import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsBoolean } from "class-validator";

/**
 * Organization Public Setting DTO
 */
export class OrganizationPublicSettingDTO {

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
	@IsBoolean()
	show_income: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
    @IsBoolean()
	show_profits: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
	@IsBoolean()
	show_bonuses_paid: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
	@IsBoolean()
	show_total_hours: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
	@IsBoolean()
	show_minimum_project_size: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
	@IsBoolean()
	show_projects_count: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
	@IsBoolean()
	show_clients_count: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
	@IsBoolean()
	show_clients: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
	@IsBoolean()
	show_employees_count: boolean;
}