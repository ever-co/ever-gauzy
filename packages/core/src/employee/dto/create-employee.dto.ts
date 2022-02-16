import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsNotEmptyObject, IsObject, ValidateNested } from "class-validator";
import { IntersectionType } from "@nestjs/mapped-types";
import { IEmployee, IEmployeeCreateInput } from "@gauzy/contracts";
import { EmploymentDTO } from "./employment.dto";
import { UserInputDTO } from "./user-input-dto";
import { RelationalTagDTO } from "./../../tags/dto";

/**
 * Employee Create DTO
 * 
 */
export class CreateEmployeeDTO extends IntersectionType(
    EmploymentDTO,
    RelationalTagDTO
) implements IEmployeeCreateInput {

    @ApiProperty({ type: () => UserInputDTO, required: true, readOnly: true })
    @IsObject()
    @IsNotEmptyObject()
    @ValidateNested()
    @Type(() => UserInputDTO)
    readonly user: UserInputDTO;

    @ApiProperty({ type: () => String, required: true, readOnly: true })
    @IsNotEmpty()
    readonly password: string;

    readonly members?: IEmployee[];
    originalUrl?: string;
}