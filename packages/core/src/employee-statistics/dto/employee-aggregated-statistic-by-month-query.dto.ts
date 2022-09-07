import { IMonthAggregatedEmployeeStatisticsFindInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { EmployeeFeatureDTO } from "../../employee/dto";
import { DateRangeQueryDTO } from "../../shared/dto";

/**
 * Get employee statistic query request DTO validation
 */
export class EmployeeAggregatedStatisticByMonthQueryDTO extends IntersectionType(
    DateRangeQueryDTO,
    EmployeeFeatureDTO
) implements IMonthAggregatedEmployeeStatisticsFindInput {}