import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsString, ValidateIf } from "class-validator";

export class UpdateInvoiceOptionsDTO {

    @ApiProperty({ type: () => String, readOnly: true })
    @ValidateIf((it) => !it.isArchived)
    @IsNotEmpty()
	@IsString()
    readonly internalNote: string;

    @ApiProperty({ type: () => Boolean, readOnly: true })
    @ValidateIf((it) => !it.internalNote)
    @IsNotEmpty()
	@IsBoolean()
    readonly isArchived: boolean;
}