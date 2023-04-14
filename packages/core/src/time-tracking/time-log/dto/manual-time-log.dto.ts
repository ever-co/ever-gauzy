import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";
import { IEmployee, IManualTimeInput } from "@gauzy/contracts";
import { IsBeforeDate } from "./../../../shared/validators";
import { TenantOrganizationBaseDTO } from "./../../../core/dto";

export class ManualTimeLogDTO extends TenantOrganizationBaseDTO implements IManualTimeInput {

    @ApiProperty({ type: () => Date })
    @IsNotEmpty({
        message: "Started date should not be empty"
    })
    @IsBeforeDate(ManualTimeLogDTO, (it) => it.stoppedAt, {
        message: "Started date must be before stopped date"
    })
    startedAt: Date;

    @ApiProperty({ type: () => Date })
    @IsNotEmpty({
        message: "Stopped date should not be empty"
    })
    stoppedAt: Date;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsUUID()
    employeeId: IEmployee['id'];
}
