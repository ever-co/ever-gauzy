import { IEmployee, PermissionsEnum } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsObject, IsOptional, IsString } from "class-validator";
import { Employee } from "./../employee.entity";
import { RequestContext } from "./../../core/context";

interface IRelationalEmployee {
    readonly employee: IEmployee;
    readonly employeeId: IEmployee['id'];
}

export class EmployeeFeatureDTO implements IRelationalEmployee  {

    @ApiPropertyOptional({ type: () => Employee, readOnly: true })
    @IsOptional()
    @IsObject()
    @Transform((params: TransformFnParams) => RequestContext.hasPermission(
        PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
    ) ? params.value : {
        id: RequestContext.currentEmployeeId()
    })
    readonly employee: IEmployee;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    @Transform(
        (params: TransformFnParams) => RequestContext.hasPermission(
            PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
        ) ? params.value : RequestContext.currentEmployeeId()
    )
    readonly employeeId: IEmployee['id'];
}