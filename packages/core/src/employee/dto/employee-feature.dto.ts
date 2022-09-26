import { IEmployee } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsString, ValidateIf } from "class-validator";
import { Employee } from "./../employee.entity";
import { IsEmployeeBelongsToOrganization } from "./../../shared/validators";

interface IRelationalEmployee {
    readonly employee: IEmployee;
    readonly employeeId: IEmployee['id'];
}

export class EmployeeFeatureDTO implements IRelationalEmployee  {

    @ApiPropertyOptional({ type: () => Employee, readOnly: true })
    @ValidateIf((it) => !it.employeeId || it.employee)
    @IsObject()
    @IsEmployeeBelongsToOrganization()
    readonly employee: IEmployee;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @ValidateIf((it) => !it.employee || it.employeeId)
    @IsString()
    @IsEmployeeBelongsToOrganization()
    readonly employeeId: IEmployee['id'];
}