import { IRecurringExpenseEditInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { PartialType } from "@nestjs/swagger";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { RelationalCurrencyDTO } from "./../../currency/dto";
import { EmployeeRecurringExpenseDTO } from "./employee-recurring-expense.dto";

export class UpdateEmployeeRecurringExpenseDTO extends IntersectionType(
	    EmployeeRecurringExpenseDTO,
	    // See CreateEmployeeRecurringExpenseDTO: `employee` / `employeeId` must stay optional so an
	    // existing recurring expense can be edited back to "All Employees" (employeeId null) without
	    // the same HTTP 400 (#8889).
	    PartialType(EmployeeFeatureDTO),
	    RelationalCurrencyDTO
	) implements IRecurringExpenseEditInput {}
