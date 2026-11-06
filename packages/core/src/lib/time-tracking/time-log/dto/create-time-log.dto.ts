
import { ApiHideProperty, ApiProperty } from "@nestjs/swagger";
import { Expose, Transform, TransformFnParams } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { IManualTimeInput, TimeLogSourceEnum, TimeLogType } from "@gauzy/contracts";
import { ManualTimeLogDTO } from "./manual-time-log.dto";
import { isTrackerSource } from "../tracker-source";

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

    /**
     * Whether a tracker uploaded the entry: the desktop timer and the agent send here the time they tracked
     * offline, with their own source. Read from the source the body sent, before `source` above restates it, so a
     * body cannot set it any other way.
     */
    @ApiHideProperty()
    @Expose()
    @Transform(({ obj }: TransformFnParams) => isTrackerSource(obj?.source))
    @IsOptional()
    @IsBoolean()
    readonly uploadedByTracker?: boolean;
}
