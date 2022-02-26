import { IRecurringExpenseEditInput } from "@gauzy/contracts";
import { EmployeeRecurringExpenseDTO } from "./employee-recurring-expense.dto";

export class UpdateEmployeeRecurringExpenseDTO extends EmployeeRecurringExpenseDTO implements IRecurringExpenseEditInput {}