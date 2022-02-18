import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty } from "class-validator";
import { UpdateEstimateStatusDTO } from ".";

export class ConvertToInvoiceDTO extends UpdateEstimateStatusDTO {

    @ApiProperty({ type: () => Boolean, readOnly: true })
    @IsNotEmpty()
    @IsBoolean()
    readonly isEstimate: false

}