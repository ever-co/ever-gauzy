import { ITimerStatusInput, TimeLogSourceEnum } from "@gauzy/contracts";
import { ApiProperty, IntersectionType, PartialType, PickType } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { EmployeeFeatureDTO } from "./../../../employee/dto";
import { TenantOrganizationBaseDTO } from "./../../../core/dto";
import { RelationsQueryDTO } from "./../../../shared/dto";

export class TimerStatusQueryDTO extends IntersectionType(
    TenantOrganizationBaseDTO,
    IntersectionType(PartialType(PickType(EmployeeFeatureDTO, ['employeeId'] as const)), RelationsQueryDTO)
) implements ITimerStatusInput {

    @ApiProperty({ type: () => String, enum: TimeLogSourceEnum })
    @IsEnum(TimeLogSourceEnum)
    readonly source: TimeLogSourceEnum;
}