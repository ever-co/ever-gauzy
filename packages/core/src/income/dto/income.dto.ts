import { CurrenciesEnum } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional } from "class-validator";
import { TenantOrganizationBaseDTO } from "core/dto";

export class IncomeDTO extends TenantOrganizationBaseDTO {

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsNotEmpty()
	readonly amount: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	readonly currency: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly valueDate: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly notes: string;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@IsNotEmpty()
	readonly isBonus: boolean;

	@ApiPropertyOptional({ type: () => String, maxLength: 256 })
	@IsOptional()
	readonly reference: string;
}