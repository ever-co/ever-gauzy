import { CurrenciesEnum, PayPeriodEnum } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, Min } from "class-validator";

export abstract class RatesDTO {

    @ApiPropertyOptional({ type: () => String, enum: PayPeriodEnum })
    @IsOptional()
    @IsEnum(PayPeriodEnum)
    readonly payPeriod?: PayPeriodEnum;

    @ApiPropertyOptional({ type: () => Number })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Transform((params: TransformFnParams) => parseInt(params.value, 10))
    readonly billRateValue?: number;

    @ApiPropertyOptional({ type: () => Number })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Transform((params: TransformFnParams) => parseInt(params.value, 10))
    readonly reWeeklyLimit?: number;

    @ApiPropertyOptional({ type: () => String, enum: CurrenciesEnum })
	@IsOptional()
	@IsEnum(CurrenciesEnum)
	readonly billRateCurrency?: string;
}