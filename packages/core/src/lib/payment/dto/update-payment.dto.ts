import { IPaymentUpdateInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { RelationalCurrencyDTO } from "./../../currency/dto";
import { RelationalTagDTO } from "./../../tags/dto";
import { PaymentDTO } from "./payment.dto";

/**
 * Update payment request DTO validation
 *
 */
export class UpdatePaymentDTO extends IntersectionType(
    PaymentDTO,
    RelationalTagDTO,
    RelationalCurrencyDTO
) implements IPaymentUpdateInput {}