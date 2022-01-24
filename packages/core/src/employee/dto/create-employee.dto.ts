import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { EmployeeInputDto } from "./employee-input.dto";


export class CreateEmployeeDto  {

    @IsArray()
    @ValidateNested({ each: true })
    @Type(()=>EmployeeInputDto)
    list : EmployeeInputDto[]
    
}