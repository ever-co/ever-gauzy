import { IntersectionType } from "@nestjs/mapped-types";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { DateRangeQueryDTO, RelationsQueryDTO } from "./../../shared/dto";

export class EmployeeRecurringExpenseQueryDTO extends IntersectionType(
    EmployeeFeatureDTO,
    DateRangeQueryDTO,
    RelationsQueryDTO
) {}