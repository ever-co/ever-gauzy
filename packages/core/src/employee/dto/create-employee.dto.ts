import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { EmployeeInputDTO } from "./employee-input.dto";

export class CreateEmployeeDTO  {

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EmployeeInputDTO)
    list : EmployeeInputDTO[]
}