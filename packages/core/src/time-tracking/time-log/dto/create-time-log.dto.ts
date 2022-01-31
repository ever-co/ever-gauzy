
import { IManualTimeInput, TimeLogSourceEnum, TimeLogType } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsEnum } from "class-validator";
import { ManualTimeLogDTO } from "./manual-time-log.dto";

export class CreateManualTimeLogDTO extends ManualTimeLogDTO implements IManualTimeInput {

    @ApiProperty({ type: () => String, enum: TimeLogType })
    @IsEnum(TimeLogType)
    @Transform((params: TransformFnParams) => TimeLogType.MANUAL)
    logType: TimeLogType;

    @ApiProperty({ type: () => String, enum: TimeLogSourceEnum })
    @Transform((params: TransformFnParams) => TimeLogSourceEnum.BROWSER)
    @IsEnum(TimeLogSourceEnum)
    source: TimeLogSourceEnum;
}