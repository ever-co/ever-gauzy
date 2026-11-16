import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsISO8601, IsOptional } from "class-validator";
import { IManualTimeInput, TimeLogSourceEnum, TimeLogType } from "@gauzy/contracts";
import { ManualTimeLogDTO } from "./manual-time-log.dto";

export class UpdateManualTimeLogDTO extends ManualTimeLogDTO implements IManualTimeInput {
    /**
     * The edit-time-log modal sends the log type and source on update too.
     */
    @ApiPropertyOptional({ type: () => String, enum: TimeLogType })
    @IsOptional()
    @IsEnum(TimeLogType)
    logType?: TimeLogType;

    @ApiPropertyOptional({ type: () => String, enum: TimeLogSourceEnum })
    @IsOptional()
    @IsEnum(TimeLogSourceEnum)
    source?: TimeLogSourceEnum;

    /**
     * The `updatedAt` the entry was read with (ever-co/ever-teams#5382). Stated, the edit is saved only while the entry
     * still holds it, in the transaction that compares the two; otherwise nothing is saved and the answer is 409 with
     * the entry as it is now. Left out, the edit is saved as it always was. Never a column: the update does not write it.
     */
    @ApiPropertyOptional({
        type: () => String,
        format: 'date-time',
        description:
            'The updatedAt the time entry was read with. When stated, the change is saved only if the entry still ' +
            'holds it; otherwise nothing is saved and the answer is 409 Conflict (CONCURRENT_MODIFICATION) with the ' +
            'entry as it is now.'
    })
    @IsOptional()
    @IsISO8601({ strict: true })
    expectedUpdatedAt?: string;
}
