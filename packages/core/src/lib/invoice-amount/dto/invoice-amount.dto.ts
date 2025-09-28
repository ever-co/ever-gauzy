import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { CurrenciesEnum } from '@gauzy/contracts';

export class InvoiceAmountDTO {
	@ApiProperty({ type: () => String, enum: CurrenciesEnum, readOnly: true, example: CurrenciesEnum.USD })
	@IsOptional()
	@IsEnum(CurrenciesEnum)
	readonly currency: CurrenciesEnum;

	@ApiProperty({ type: () => Number, readOnly: true, example: 1200.5 })
	@IsOptional()
	@IsNumber()
	readonly totalValue: number;
}
