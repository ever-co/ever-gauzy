import { IPayment } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsDate, IsOptional } from "class-validator";
import { PaymentDTO } from "./payment.dto";

export class CreatePaymentDTO extends PaymentDTO implements IPayment {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsDate()
    readonly paymentDate?: Date;
    
}