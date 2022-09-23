import { IPayment } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { RelationalCurrencyDTO } from "./../../currency/dto";
import { RelationalTagDTO } from "./../../tags/dto";
import { PaymentDTO } from "./payment.dto";

export class UpdatePaymentDTO extends IntersectionType(
    PaymentDTO,
    RelationalTagDTO,
    RelationalCurrencyDTO,
    EmployeeFeatureDTO
) implements IPayment {}