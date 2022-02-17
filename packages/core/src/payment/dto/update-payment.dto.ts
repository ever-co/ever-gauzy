import { IPayment } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { RelationalTagDTO } from "./../../tags/dto";
import { PaymentDTO } from "./payment.dto";

export class UpdatePaymentDTO extends IntersectionType(
    PaymentDTO,
    RelationalTagDTO
) implements IPayment {}