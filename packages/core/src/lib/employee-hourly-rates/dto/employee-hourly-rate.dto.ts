import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { CurrenciesEnum, ID } from '@gauzy/contracts';

export class EmployeeHourlyRateDTO {
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	billRateValue?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	minimumBillingRate?: number;

	@ApiPropertyOptional({ type: () => String, enum: CurrenciesEnum })
	@IsOptional()
	@IsEnum(CurrenciesEnum)
	billRateCurrency?: CurrenciesEnum;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	lastUpdate?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	employeeId?: ID;
}
