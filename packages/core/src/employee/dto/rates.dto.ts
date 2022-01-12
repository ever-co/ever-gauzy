import { CurrenciesEnum, PayPeriodEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";

export abstract class RatesDTO {

    @ApiProperty({ type: () => String, enum: PayPeriodEnum })
    @IsOptional()
    @IsEnum(PayPeriodEnum)
    readonly payPeriod?: PayPeriodEnum;

    @ApiProperty({ type: () => Number })
    @IsOptional()
    @IsInt()
    @Min(1)
    readonly billRateValue?: number;

    @ApiProperty({ type: () => Number })
    @IsOptional()
    @IsInt()
    @Min(1)
    readonly reWeeklyLimit?: number;

    @ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsOptional()
	@IsEnum(CurrenciesEnum)
	readonly billRateCurrency?: string;
}