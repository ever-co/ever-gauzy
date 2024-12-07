import { TimeFrameStatusEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";

export class GoalTimeFrameDTO {

    @ApiProperty({ type: () => String, readOnly : true })
    @IsNotEmpty()
    @IsString()
    readonly name: string;

    @ApiProperty({ type: () => String, enum: TimeFrameStatusEnum, readOnly : true })
    @IsEnum(TimeFrameStatusEnum)
    @IsNotEmpty()
    readonly status: TimeFrameStatusEnum;

    @ApiProperty({ type: () => Date, readOnly : true })
    @IsNotEmpty()
    readonly startDate: Date;

    @ApiProperty({ type: () => Date, readOnly : true })
    @IsNotEmpty()
    readonly endDate: Date;

}