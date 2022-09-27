import { IIncomeCreateInput } from "@gauzy/contracts";
import { IntersectionType, PartialType } from "@nestjs/mapped-types";
import { RelationalCurrencyDTO } from "./../../currency/dto";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { RelationalTagDTO } from "./../../tags/dto";
import { IncomeDTO } from "./income.dto";

export class CreateIncomeDTO extends IntersectionType(
    IncomeDTO,
    PartialType(EmployeeFeatureDTO),
    RelationalTagDTO,
    RelationalCurrencyDTO
) implements IIncomeCreateInput {}