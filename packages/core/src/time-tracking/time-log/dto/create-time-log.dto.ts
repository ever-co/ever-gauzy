
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum } from "class-validator";
import { IManualTimeInput, TimeLogSourceEnum, TimeLogType } from "@gauzy/contracts";
import { ManualTimeLogDTO } from "./manual-time-log.dto";

export class CreateManualTimeLogDTO extends ManualTimeLogDTO implements IManualTimeInput {

    @ApiProperty({ type: () => String, enum: TimeLogType })
    @IsEnum(TimeLogType)
    @Transform(() => TimeLogType.MANUAL)
    logType: TimeLogType;

    @ApiProperty({ type: () => String, enum: TimeLogSourceEnum })
    @IsEnum(TimeLogSourceEnum)
    @Transform(() => TimeLogSourceEnum.WEB_TIMER)
    source: TimeLogSourceEnum;
}
