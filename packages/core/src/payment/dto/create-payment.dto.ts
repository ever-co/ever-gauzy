import { IPayment } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { RelationalCurrencyDTO } from "./../../currency/dto";
import { RelationalTagDTO } from "./../../tags/dto";
import { PaymentDTO } from "./payment.dto";

export class CreatePaymentDTO extends IntersectionType(
    PaymentDTO,
    RelationalTagDTO,
    RelationalCurrencyDTO,
    EmployeeFeatureDTO
) implements IPayment {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    readonly paymentDate?: Date;
}