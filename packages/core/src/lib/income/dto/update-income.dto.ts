import { IIncomeUpdateInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { RelationalCurrencyDTO } from "./../../currency/dto";
import { RelationalTagDTO } from "./../../tags/dto";
import { IncomeDTO } from "./income.dto";

/**
 * Update income request DTO validation
 */
export class UpdateIncomeDTO extends IntersectionType(
    IncomeDTO,
    RelationalTagDTO,
    RelationalCurrencyDTO
) implements IIncomeUpdateInput {}