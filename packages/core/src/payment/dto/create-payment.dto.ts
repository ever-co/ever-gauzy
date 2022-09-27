import { IPayment } from "@gauzy/contracts";
import { IntersectionType, PartialType } from "@nestjs/mapped-types";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { RelationalCurrencyDTO } from "./../../currency/dto";
import { RelationalTagDTO } from "./../../tags/dto";
import { PaymentDTO } from "./payment.dto";

/**
 * Create payment request DTO validation
 *
 */
export class CreatePaymentDTO extends IntersectionType(
    PaymentDTO,
    RelationalTagDTO,
    RelationalCurrencyDTO,
    PartialType(EmployeeFeatureDTO)
) implements IPayment {}