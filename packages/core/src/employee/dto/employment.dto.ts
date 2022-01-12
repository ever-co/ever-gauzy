import { ApiProperty } from "@nestjs/swagger";
import { IsDate, IsOptional } from "class-validator";
import { HiringDTO } from "./hiring.dto";

export abstract class EmploymentDTO extends HiringDTO {

    @ApiProperty({ type: () => Date })
    @IsOptional()
    @IsDate({
        message: "Started worked on must be a Date instance"
    })
    readonly startedWorkOn?: Date;
}