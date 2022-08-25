import { PermissionsEnum } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsOptional, IsString } from "class-validator";
import { RequestContext } from "./../../core/context";

export class RelationalEmployeeDTO {

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    @Transform(
        (params: TransformFnParams) => RequestContext.hasPermission(
            PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
        ) ? params.value : RequestContext.currentEmployeeId()
    )
    readonly employeeId: string;
}