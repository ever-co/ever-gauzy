import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional } from "class-validator";
import { IGetTimesheetInput } from "@gauzy/contracts";
import { SelectorsQueryDTO } from "./../../../../shared/dto";

/**
 * Get timesheet request DTO validation
 */
export class TimesheetQueryDTO extends SelectorsQueryDTO implements IGetTimesheetInput {
    
    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly relations: string[];
}