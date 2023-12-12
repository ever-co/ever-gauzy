
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum } from "class-validator";
import { IManualTimeInput, TimeLogSourceEnum, TimeLogType } from "@gauzy/contracts";
import { ManualTimeLogDTO } from "./manual-time-log.dto";

/**
 * DTO for creating manual time logs.
 * Extends ManualTimeLogDTO and implements IManualTimeInput.
 */
export class CreateManualTimeLogDTO extends ManualTimeLogDTO implements IManualTimeInput {
    /**
    * Type of the time log (e.g., MANUAL).
    */
    @ApiProperty({ type: () => String, enum: TimeLogType })
    @IsEnum(TimeLogType)
    @Transform(() => TimeLogType.MANUAL)
    logType: TimeLogType;

    /**
     * Source of the time log (e.g., WEB_TIMER).
     */
    @ApiProperty({ type: () => String, enum: TimeLogSourceEnum })
    @IsEnum(TimeLogSourceEnum)
    @Transform(() => TimeLogSourceEnum.WEB_TIMER)
    source: TimeLogSourceEnum;
}
