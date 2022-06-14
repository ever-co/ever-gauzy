import { IGetTimeLogReportInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { DateRangeQueryDTO, FiltersQueryDTO } from "./../../../../shared/dto";


/**
 * Get time log request DTO validation
 */
export class TimeLogReportQueryDTO extends IntersectionType(
    FiltersQueryDTO,
    DateRangeQueryDTO
) implements IGetTimeLogReportInput {}