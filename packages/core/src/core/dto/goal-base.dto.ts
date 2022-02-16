import { IGoalTemplate } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

export class GoalBaseDTO {
    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsObject()
    readonly goal: IGoalTemplate;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly goalId: string;
}