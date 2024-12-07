import { IExpenseFindInput } from "@gauzy/contracts";
import { IntersectionType, PartialType, PickType } from "@nestjs/mapped-types";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { ExpenseDTO } from "./expense.dto";

/**
 * Delete expense request DTO validation
 */
export class DeleteExpenseDTO extends IntersectionType(
    PickType(
        ExpenseDTO,
        ['organization', 'organizationId'] as const
    ),
    PartialType(EmployeeFeatureDTO)
) implements IExpenseFindInput {}