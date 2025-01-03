import { IRecurringExpenseEditInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { RelationalCurrencyDTO } from "./../../currency/dto";
import { EmployeeRecurringExpenseDTO } from "./employee-recurring-expense.dto";

export class UpdateEmployeeRecurringExpenseDTO extends IntersectionType(
    EmployeeRecurringExpenseDTO,
    EmployeeFeatureDTO,
    RelationalCurrencyDTO
) implements IRecurringExpenseEditInput {}