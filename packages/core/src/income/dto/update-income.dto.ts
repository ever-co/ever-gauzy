import { IIncomeUpdateInput } from "@gauzy/contracts";
import { CreateIncomeDTO } from "./create-income.dto";

export class UpdateIncomeDTO extends CreateIncomeDTO implements IIncomeUpdateInput {}