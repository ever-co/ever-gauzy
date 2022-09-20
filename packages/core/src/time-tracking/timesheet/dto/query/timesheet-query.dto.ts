import { IGetTimesheetInput } from "@gauzy/contracts";
import { RelationsQueryDTO, SelectorsQueryDTO } from "./../../../../shared/dto";
import { IntersectionType } from "@nestjs/mapped-types";

/**
 * Get timesheet request DTO validation
 */
export class TimesheetQueryDTO extends IntersectionType(
    RelationsQueryDTO,
    SelectorsQueryDTO
) implements IGetTimesheetInput {}