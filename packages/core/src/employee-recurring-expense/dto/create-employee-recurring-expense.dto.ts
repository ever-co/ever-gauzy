import { IRecurringExpenseModel } from "@gauzy/contracts";
import { EmployeeRecurringExpenseDTO } from "./employee-recurring-expense.dto";

export class CreateEmployeeRecurringExpenseDTO extends EmployeeRecurringExpenseDTO implements IRecurringExpenseModel {}