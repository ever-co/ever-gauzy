import { IGoalTemplate } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

export  class RelationalGoalTemplateDTO {

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly goal: IGoalTemplate;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly goalId: string;
}