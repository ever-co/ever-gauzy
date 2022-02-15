import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty } from "class-validator";

export abstract class UpdateEstimateInvoiceDTO {

    @ApiProperty({ type: () => Boolean, readOnly: true })
    @IsNotEmpty()
    @IsBoolean()
    readonly isAccepted: boolean;

}