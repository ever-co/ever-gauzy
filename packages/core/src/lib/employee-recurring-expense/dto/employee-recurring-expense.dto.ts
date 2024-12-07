import { ApiProperty } from "@nestjs/swagger";
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class EmployeeRecurringExpenseDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsNotEmpty()
    @IsNumber()
    readonly value: number;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly categoryName: string;

    @ApiProperty({ type: () => Number, minimum: 1, maximum: 31, readOnly: true })
    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    @Max(31)
    readonly startDay: number;

    @ApiProperty({ type: () => Number, minimum: 1, maximum: 12, readOnly: true })
    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    @Max(12)
    readonly startMonth: number;

    @ApiProperty({ type: () => Number, minimum: 1, readOnly: true })
    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    readonly startYear: number;

    @ApiProperty({ type: () => Date, readOnly: true })
    @IsNotEmpty()
    readonly startDate: Date;

    @ApiProperty({ type: () => Number, minimum: 1, maximum: 31, readOnly: true })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(31)
    readonly endDay: number;

    @ApiProperty({ type: () => Number, minimum: 1, maximum: 12, readOnly: true })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(12)
    readonly endMonth: number;

    @ApiProperty({ type: () => Number, minimum: 1, readOnly: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly endYear: number;

    @ApiProperty({ type: () => Date, readOnly: true })
    @IsOptional()
    @IsDate()
    readonly endDate: Date;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly parentRecurringExpenseId: string;
}