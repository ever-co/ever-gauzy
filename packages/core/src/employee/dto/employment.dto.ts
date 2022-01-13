import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDate, IsOptional, IsString } from "class-validator";
import { HiringDTO } from "./hiring.dto";

export abstract class EmploymentDTO extends HiringDTO {

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsDate({
        message: "Started worked on must be a Date instance"
    })
    readonly startedWorkOn?: Date;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly short_description?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly description?: string;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly anonymousBonus?: boolean;
}