import { IntersectionType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional } from "class-validator";
import { IGetTimeSlotInput } from "@gauzy/contracts";
import { FiltersQueryDTO, SelectorsQueryDTO } from "./../../../../shared/dto";

/**
 * Get time slot request DTO validation
 */
export class TimeSlotQueryDTO extends IntersectionType(
    FiltersQueryDTO,
    SelectorsQueryDTO
) implements IGetTimeSlotInput {
    
    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly relations: string[];
}