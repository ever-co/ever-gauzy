import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
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
}
