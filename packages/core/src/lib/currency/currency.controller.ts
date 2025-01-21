import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import { Public } from '@gauzy/common';
import { Currency } from './currency.entity';
import { CurrencyService } from './currency.service';

@ApiTags('Currency')
@Controller('/currency')
@Public()
export class CurrencyController {
	constructor(private readonly currencyService: CurrencyService) {}

	@ApiOperation({ summary: 'Find all currencies.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found currencies',
		type: Currency
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(): Promise<IPagination<Currency>> {
		return this.currencyService.findAll();
	}
}
