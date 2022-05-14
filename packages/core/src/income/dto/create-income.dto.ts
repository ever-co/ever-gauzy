import { IIncomeCreateInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { RelationalTagDTO } from "./../../tags/dto";
import { IncomeDTO } from "./income.dto";

export class CreateIncomeDTO extends IntersectionType(
    IncomeDTO,
    RelationalTagDTO
) implements IIncomeCreateInput {
    @ApiProperty({ type: () => String })
    @IsString()
    @IsNotEmpty()
    readonly clientId: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    @IsOptional()
    readonly employeeId: string;
}