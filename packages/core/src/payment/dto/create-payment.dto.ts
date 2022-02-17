import { IPayment } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { RelationalTagDTO } from "./../../tags/dto";
import { PaymentDTO } from "./payment.dto";

export class CreatePaymentDTO extends IntersectionType(
    PaymentDTO,
    RelationalTagDTO
) implements IPayment {
    
    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    readonly paymentDate?: Date;
}