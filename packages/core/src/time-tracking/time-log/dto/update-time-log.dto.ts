import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { IManualTimeInput } from "@gauzy/contracts";
import { IsBeforeDate } from "shared/decorators/validations";


export class UpdateManualTimeLogDTO implements IManualTimeInput {

    @ApiProperty({ type: () => Date })
    @IsNotEmpty({
        message: "Started date should not be empty"
    })
    @IsBeforeDate(UpdateManualTimeLogDTO, (it) => it.stoppedAt, {
        message: "Started date must be before stopped date"
    })
    readonly startedAt: Date;

    @ApiProperty({ type: () => Date })
    @IsNotEmpty({
        message: "Stopped date should not be empty"
    })
    readonly stoppedAt: Date;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    readonly employeeId: string;
}