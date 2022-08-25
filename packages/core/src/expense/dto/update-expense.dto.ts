import { IExpenseUpdateInput } from "@gauzy/contracts";
import { CreateExpenseDTO } from "./create-expense.dto";

export class UpdateExpenseDTO extends CreateExpenseDTO
    implements IExpenseUpdateInput {}