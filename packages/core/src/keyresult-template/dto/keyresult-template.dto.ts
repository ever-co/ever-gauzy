import { KeyResultDeadlineEnum, KeyResultTypeEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class KeyresultTemplateDTO {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly name: string;

    @ApiProperty({ type: () => String, enum: KeyResultTypeEnum })
    @IsEnum(KeyResultTypeEnum)
    @IsNotEmpty()
    readonly type: KeyResultTypeEnum;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly unit: string;

    @ApiProperty({ type: () => Number })
    @IsOptional()
    @IsNumber()
    readonly targetValue: number;

    @ApiProperty({ type: () => Number })
    @IsOptional()
    @IsNumber()
    readonly initialValue: number;

    @ApiProperty({ type: () => String, enum: KeyResultDeadlineEnum })
    @IsEnum(KeyResultDeadlineEnum)
    @IsNotEmpty()
    readonly deadline: KeyResultDeadlineEnum;

}