import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class IncomeDTO extends TenantOrganizationBaseDTO {

	@ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly clientId: string;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsNotEmpty()
	@IsNumber()
	readonly amount: number;

	@ApiPropertyOptional({ type: () => Date, readOnly: true })
	@IsOptional()
	readonly valueDate: Date;

	@ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	readonly notes: string;

	@ApiPropertyOptional({ type: () => Boolean, readOnly: true })
	@IsOptional()
	@IsBoolean()
	@Transform((params: TransformFnParams) => ((params.value) || false))
	readonly isBonus: boolean;

	@ApiPropertyOptional({ type: () => String, maxLength: 256, readOnly: true })
	@IsOptional()
	readonly reference: string;
}