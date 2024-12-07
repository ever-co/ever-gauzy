import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty } from "class-validator";

export class UpdateEstimateInvoiceDTO {

    @ApiProperty({ type: () => Boolean, readOnly: true })
    @IsNotEmpty()
    @IsBoolean()
    readonly isAccepted: boolean;
}