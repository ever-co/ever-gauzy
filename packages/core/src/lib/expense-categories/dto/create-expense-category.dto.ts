import { IExpenseCategory } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { RelationalTagDTO } from "../../tags/dto";
import { ExpenseCategoryDTO } from "./expense-category.dto";

/**
 * Create expense category request validation
 */
export class CreateExpenseCategoryDTO extends IntersectionType(
    ExpenseCategoryDTO,
    RelationalTagDTO
) implements IExpenseCategory {}
