import { CurrenciesEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";

export class RelationalCurrencyDTO {

    @ApiProperty({ type: () => String, enum: CurrenciesEnum, readOnly: true })
    @IsEnum(CurrenciesEnum)
    @IsNotEmpty()
    readonly currency: CurrenciesEnum;
}