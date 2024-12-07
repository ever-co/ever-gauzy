import { GoalOwnershipEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from "class-validator";

export abstract class GoalGeneralSettingDTO {

    @ApiProperty({ type: () => Number, readOnly : true })
    @IsNotEmpty()
    @IsNumber()
    readonly maxObjectives: number;

    @ApiProperty({ type: () => Number, readOnly : true })
    @IsOptional()
    @IsNumber()
    maxKeyResults: number;

    @ApiProperty({ type: () => Boolean, readOnly : true })
    @IsOptional()
    employeeCanCreateObjective: boolean;

    @ApiProperty({ type: () => String, enum: GoalOwnershipEnum, readOnly : true })
    @IsOptional()
    @IsEnum(GoalOwnershipEnum)
    canOwnObjectives: GoalOwnershipEnum;

    @ApiProperty({ type: () => String, enum: GoalOwnershipEnum , readOnly : true })
    @IsOptional()
    @IsEnum(GoalOwnershipEnum)
    canOwnKeyResult: GoalOwnershipEnum;

    @ApiProperty({ type: () => Boolean, readOnly : true })
    @IsOptional()
    krTypeKPI: boolean;

    @ApiProperty({ type: () => Boolean, readOnly : true })
    @IsOptional()
    krTypeTask: boolean;

}