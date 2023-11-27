import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";
import { IEmployee, IManualTimeInput } from "@gauzy/contracts";
import { IsBeforeDate } from "./../../../shared/validators";
import { TenantOrganizationBaseDTO } from "./../../../core/dto";

/**
 * Data transfer object for creating or updating ManualTimeLog entities.
 */
export class ManualTimeLogDTO extends TenantOrganizationBaseDTO implements IManualTimeInput {

    /**
     * The start date and time of the manual time log.
     */
    @ApiProperty({ type: () => Date })
    @IsNotEmpty({ message: "Started date should not be empty" })
    @IsBeforeDate(ManualTimeLogDTO, (it) => it.stoppedAt, {
        message: "Started date must be before stopped date"
    })
    startedAt: Date;

    /**
     * The end date and time of the manual time log.
     */
    @ApiProperty({ type: () => Date })
    @IsNotEmpty({ message: "Stopped date should not be empty" })
    stoppedAt: Date;

    /**
     * The ID of the employee associated with the manual time log.
     */
    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsUUID()
    employeeId: IEmployee['id'];
}
