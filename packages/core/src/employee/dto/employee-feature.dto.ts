import { IEmployee } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsObject, IsString, ValidateIf } from "class-validator";
import { Employee } from "core";
import { TenantOrganizationBaseDTO } from "core/dto";

export class EmployeeFeatureDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => Employee, readOnly: true })
    @ValidateIf((emp) => !emp.employeeId)
    @IsNotEmpty()
    @IsObject()
    readonly employee: IEmployee;

    @ApiProperty({ type: () => String, readOnly: true })
    @ValidateIf((emp) => !emp.employee)
    @IsNotEmpty()
    @IsString()
    readonly employeeId: string;
}