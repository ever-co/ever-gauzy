import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdateInvoiceActionDTO {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsString()
    @IsNotEmpty()
    readonly status: string;

    @ApiProperty({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isEstimate: boolean;

}