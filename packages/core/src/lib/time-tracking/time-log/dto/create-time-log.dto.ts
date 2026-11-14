
import { ApiHideProperty, ApiProperty } from "@nestjs/swagger";
import { Expose, Transform, TransformFnParams } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { IManualTimeInput, TimeLogSourceEnum, TimeLogType } from "@gauzy/contracts";
import { ManualTimeLogDTO } from "./manual-time-log.dto";
import { isTrackerSource } from "../tracker-source";

/**
 * The type of an entry added by hand: a BREAK when the body asks for one, MANUAL otherwise. Any other type a body
 * names (TRACKED, IDLE, RESUMED) is still recorded as MANUAL, as before breaks existed.
 *
 * @param sent The type the body names, if any.
 */
export function manualEntryType(sent: unknown): TimeLogType {
    if (sent === TimeLogType.BREAK) {
        return TimeLogType.BREAK;
    }
    return TimeLogType.MANUAL;
}

/**
 * DTO for creating manual time logs.
 * Extends ManualTimeLogDTO and implements IManualTimeInput.
 */
export class CreateManualTimeLogDTO extends ManualTimeLogDTO implements IManualTimeInput {
    /**
    * Type of the time log: MANUAL, or BREAK for a break added by hand (see manualEntryType).
    */
    @ApiProperty({ type: () => String, enum: TimeLogType })
    @IsEnum(TimeLogType)
    @Transform(({ value }: TransformFnParams) => manualEntryType(value))
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
