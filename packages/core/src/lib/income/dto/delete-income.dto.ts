import { IIncomeFindInput } from "@gauzy/contracts";
import { IntersectionType, PartialType, PickType } from "@nestjs/mapped-types";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { IncomeDTO } from "./income.dto";

/**
 * Delete income request DTO validation
 */
export class DeleteIncomeDTO extends IntersectionType(
    PickType(
        IncomeDTO,
        ['organization', 'organizationId'] as const
    ),
    PartialType(EmployeeFeatureDTO)
) implements IIncomeFindInput {}