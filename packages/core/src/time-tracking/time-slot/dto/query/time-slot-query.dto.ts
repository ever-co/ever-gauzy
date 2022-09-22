import { IntersectionType } from "@nestjs/mapped-types";
import { IGetTimeSlotInput } from "@gauzy/contracts";
import { FiltersQueryDTO, RelationsQueryDTO, SelectorsQueryDTO } from "./../../../../shared/dto";

/**
 * Get time slot request DTO validation
 */
export class TimeSlotQueryDTO extends IntersectionType(
    FiltersQueryDTO,
    SelectorsQueryDTO,
    RelationsQueryDTO
) implements IGetTimeSlotInput {}